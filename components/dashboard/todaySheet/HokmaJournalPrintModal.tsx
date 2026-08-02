'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Palette, Edit3, Users, Search, Filter } from 'lucide-react';
import { Student, SessionLog } from '@/types/dashboard';
import { supabase } from '@/lib/supabase';
import { isValidHistoryLog } from '@/lib/studentDataEnricher';

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

// 🎨 다채로운 인쇄 테마 정의
const JOURNAL_THEMES = {
  slateBlue: {
    name: '슬레이트 인디고 블루 (추천)',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#7387A5',
    headerText: '#ffffff',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#374151',
    metaTextColor: '#1f2937',
    logoFilter: 'invert(52%) sepia(21%) saturate(718%) hue-rotate(177deg) brightness(91%) contrast(87%)',
  },
  indigo: {
    name: '보라 인디고',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#f3e8ff',
    headerText: '#6b21a8',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#7e22ce',
    metaTextColor: '#1f2937',
    logoFilter: 'invert(18%) sepia(85%) saturate(3000%) hue-rotate(260deg) brightness(85%) contrast(100%)', // 보라 인디고
  },
  amber: {
    name: '호박색',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#fef3e2',
    headerText: '#9a3412',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#c2410c',
    metaTextColor: '#27272a',
    logoFilter: 'invert(12%) sepia(85%) saturate(1600%) hue-rotate(350deg) brightness(85%) contrast(110%)', // 짙은 초콜릿 앰버
  },
  rose: {
    name: '핑크 로즈',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#fff0f2',
    headerText: '#9f1239',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#be123c',
    metaTextColor: '#1f2937',
    logoFilter: 'invert(13%) sepia(85%) saturate(4000%) hue-rotate(335deg) brightness(85%) contrast(100%)', // 짙은 로즈 핑크
  },
  sage: {
    name: '포레스트 세이지',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#f0f4f0',
    headerText: '#166534',
    titleColor: '#111827',
    lineColor: '#111827',
    descColor: '#15803d',
    metaTextColor: '#27272a',
    logoFilter: 'invert(22%) sepia(80%) saturate(1200%) hue-rotate(110deg) brightness(80%) contrast(100%)', // 짙은 세이지 포레스트 그린
  },
  classic: {
    name: '클래식 그레이',
    bg: '#ffffff',
    border: '#333333',
    headerBg: '#f3f4f6',
    headerText: '#1f2937',
    titleColor: '#111827',
    lineColor: '#111827',
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

  const [dateMode, setDateMode] = useState<'month' | 'custom'>('month'); // 'month': 월별, 'custom': 직접 지정
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  
  // 직접 지정 시작일 / 종료일 기본값 (현재월 1일 ~ 말일)
  const [customStartDate, setCustomStartDate] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${mm}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay).padStart(2, '0');
    return `${now.getFullYear()}-${mm}-${dd}`;
  });

  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>('amber'); // 💡 기본 테마 (호박색)
  const [selectedPenColor, setSelectedPenColor] = useState<string>('#1e3a8a'); // 기본 펜색상: 청색 볼펜
  
  // 💡 [원장님 기능] 인쇄 모달 내에서 특정 학생/날짜의 숙제 점수(완성도) 손쉽게 직접 수정
  // Key: `${studentId}_${dateKey}` -> Value: '10점' | '7점' | '4점' | '0점' | '-'
  const [hwOverrides, setHwOverrides] = useState<Record<string, string>>({});

  const handleToggleHwScore = async (studentId: string, dateKey: string, currentScore: string, targetCourse?: string) => {
    if (!dateKey || !studentId) return;
    const scoreOrder = ['10점', '7점', '4점', '0점', '-'];
    const curIdx = scoreOrder.indexOf(currentScore);
    const nextScore = scoreOrder[(curIdx + 1) % scoreOrder.length];
    const overrideKey = `${studentId}_${dateKey}`;
    
    // 1. 화면 UI 즉시 변경 (낙관적 업데이트)
    setHwOverrides(prev => ({
      ...prev,
      [overrideKey]: nextScore
    }));

    // 2. 점수별 todo_achievement (0~100%) 매핑
    let newAchievement = 0;
    if (nextScore === '10점') newAchievement = 100;
    else if (nextScore === '7점') newAchievement = 70;
    else if (nextScore === '4점') newAchievement = 40;
    else if (nextScore === '0점' || nextScore === '-') newAchievement = 0;

    try {
      // Supabase ams_daily_sheets 세션 테이블 업데이트
      const formattedDate = dateKey.replace(/\./g, '-');
      let query = supabase
        .from('ams_daily_sheets')
        .update({ todo_achievement: newAchievement })
        .eq('student_id', studentId)
        .or(`date.eq.${formattedDate},session_date.eq.${formattedDate}`);

      if (targetCourse && targetCourse !== '정규') {
        query = query.eq('course_name', targetCourse);
      }

      await query;
    } catch (err) {
      console.error('Supabase 숙제 점수 저장 실패:', err);
    }
  };
  // 💡 오늘 시트 원생이 없거나 휴일인 경우 자동으로 전체 학생 보기(true) 활성화
  const [includeOtherDays, setIncludeOtherDays] = useState(() => {
    return !selectedStudents || selectedStudents.length === 0;
  });

  React.useEffect(() => {
    if (!selectedStudents || selectedStudents.length === 0) {
      setIncludeOtherDays(true);
    }
  }, [selectedStudents]);
  // 💡 수업 유형 필터 ('all': 전체, 'regular': 정규수업만, 'special': 선택과목/특강만)
  const [courseTypeFilter, setCourseTypeFilter] = useState<'all' | 'regular' | 'special'>('all');
  const [searchQuery, setSearchQuery] = useState(''); // 이름 검색어

  // 💡 인쇄 대상 항목 리스트 연산 (학생 X 수강 코스별 1:1 독립 항목 분리)
  const printTargetItems = useMemo(() => {
    let baseList: Student[] = [];

    // 💡 모든 학생 보기 체크 시: 요일/휴일 제약 없이, '선택된 담당 선생님(selectedTeacherId)' 원생 목록을 반영합니다.
    if (includeOtherDays) {
      const fullList = (allStudents && allStudents.length > 0 ? allStudents : selectedStudents).filter(s => !s.is_deleted);
      if (selectedTeacherId === 'All') {
        baseList = fullList;
      } else {
        baseList = fullList.filter(s => s.teacher_id === selectedTeacherId);
      }
    } else {
      // 오늘 시트/휴일/요일 필터링된 원생 기준 (파생 행 중복 제거)
      const uniqueMap = new Map<string, Student>();
      (selectedStudents || []).forEach(s => {
        const realId = (s as any).originalId || s.id;
        if (!uniqueMap.has(realId) || !(s as any).isSpecialClass) {
          uniqueMap.set(realId, s);
        }
      });
      baseList = Array.from(uniqueMap.values());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      baseList = baseList.filter(s => s.name && s.name.toLowerCase().includes(q));
    }

    const items: Array<{ student: Student; courseName: string; isSpecial: boolean }> = [];
    const seenKeys = new Set<string>();

    (baseList || []).forEach(student => {
      if (!student || !student.id) return;

      // 1. 정규 수업 항목 추가 (수업 유형 필터가 'special'이 아닌 경우 무조건 추가)
      if (courseTypeFilter !== 'special') {
        const studentRealId = (student as any).originalId || student.id;
        const regKey = `${studentRealId}_정규`;
        if (!seenKeys.has(regKey)) {
          seenKeys.add(regKey);
          const rawRealName = (student as any).realName || student.name;
          const cleanName = rawRealName ? rawRealName.replace(/^(특강|방학특강|선택과목)\s*-\s*/, '') : student.name;

          items.push({
            student: { 
              ...student, 
              id: studentRealId, 
              name: cleanName,
              courseName: '정규', 
              isSpecialClass: false
            },
            courseName: '정규',
            isSpecial: false
          });
        }
      }

      // 2. 특강/선택과목 항목 추가 (수업 유형 필터가 'regular'가 아닌 경우)
      if (courseTypeFilter !== 'regular') {
        const electiveSubjects: string[] = [];
        const rawElectives = (student as any).elective_courses;
        if (Array.isArray(rawElectives)) {
          rawElectives.forEach((ec: any) => {
            if (typeof ec === 'string' && ec.trim()) electiveSubjects.push(ec.trim());
            else if (ec && typeof ec === 'object' && ec.subject) electiveSubjects.push(ec.subject.trim());
          });
        }
        
        // 💡 student.book_courses.__elective_courses 구조 파싱
        const bookElectives = (student as any).book_courses?.['__elective_courses'];
        if (bookElectives) {
          try {
            const parsed = typeof bookElectives === 'string' ? JSON.parse(bookElectives) : bookElectives;
            if (Array.isArray(parsed)) {
              parsed.forEach((ec: any) => {
                if (ec?.subject && typeof ec.subject === 'string' && ec.subject.trim()) {
                  electiveSubjects.push(ec.subject.trim());
                }
              });
            }
          } catch (e) {}
        }

        if (student.electiveCourse?.subject) {
          electiveSubjects.push(student.electiveCourse.subject.trim());
        }

        const logsToScan = [...(student.allLogs || [])];
        if (student.todaySession) logsToScan.push(student.todaySession);
        logsToScan.forEach(log => {
          if (log.course_name && log.course_name !== '정규') {
            electiveSubjects.push(log.course_name.trim());
          }
        });

        // 💡 범용 특강 명칭('특강', '방학특강', '선택과목')을 대표 과목명 하나로 통합
        const normalizedElectives: string[] = [];
        let hasGenericElective = false;

        electiveSubjects.forEach(s => {
          const trimmed = s?.trim();
          if (!trimmed || trimmed === '정규' || trimmed.length <= 1) return;
          if (['특강', '방학특강', '선택과목'].includes(trimmed)) {
            hasGenericElective = true;
          } else {
            normalizedElectives.push(trimmed);
          }
        });

        if (hasGenericElective && normalizedElectives.length === 0) {
          // 대표 과목명으로 '방학특강' 사용
          const representativeCourse = student.electiveCourse?.subject?.trim() || '방학특강';
          normalizedElectives.push(representativeCourse);
        }

        const uniqueElectives = Array.from(new Set(normalizedElectives));

        const studentRealId = (student as any).originalId || student.id;
        uniqueElectives.forEach(subj => {
          const specKey = `${studentRealId}_${subj}`;
          if (!seenKeys.has(specKey)) {
            seenKeys.add(specKey);
            items.push({
              student: { ...student, id: studentRealId, courseName: subj },
              courseName: subj,
              isSpecial: true
            });
          }
        });
      }
    });

    // 💡 [이름순 정렬] 학생 이름 가나다순으로 정렬 (동일 학생일 경우 정규 -> 특강 순)
    items.sort((a, b) => {
      const nameA = a.student.name || '';
      const nameB = b.student.name || '';
      const nameComp = nameA.localeCompare(nameB, 'ko');
      if (nameComp !== 0) return nameComp;
      return a.isSpecial ? 1 : -1; // 동일 학생 시 정규 수업이 먼저 오도록 배치
    });

    return items;
  }, [includeOtherDays, courseTypeFilter, selectedStudents, allStudents, selectedTeacherId, searchQuery]);

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

  if (!isOpen) return null;

  return createPortal(
    <div className="hokma-journal-print-root fixed inset-0 z-[9999] flex flex-col bg-slate-900/95 text-white overflow-hidden">
      {/* 스타일 태그 주입 - 선택된 테마 및 펜 색상에 맞춰 CSS 변수 동적 생성 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap');

        :root {
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
          background: transparent;
        }
        .hj-sign-table th, .hj-sign-table td {
          border: 1px solid #64748b;
          padding: 0;
          background: rgba(255, 255, 255, 0.85);
        }
        .hj-sign-table th {
          background-color: rgba(255, 255, 255, 0.95);
          color: #1f2937;
          font-weight: bold;
          width: 58px;
          height: 22px;
        }
        .hj-sign-table td {
          height: 48px;
        }
        .hj-sign-title-cell {
          width: 24px;
          background-color: rgba(255, 255, 255, 0.95);
          color: #1f2937;
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
          border-bottom: 2px solid #64748b;
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
          color: #1f2937;
        }

        /* 💡 메인 테이블 스타일 */
        .hj-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          text-align: center;
          background: transparent;
        }
        .hj-table th, .hj-table td {
          border: 1px solid #64748b;
          height: 38px;
          padding: 2px 4px;
          box-sizing: border-box;
          background-color: rgba(255, 255, 255, 0.45);
        }
        .hj-table th {
          background-color: rgba(255, 255, 255, 0.65);
          color: #1f2937;
          font-weight: bold;
        }
        /* ★ 첫 번째 열 헤더(수업 날짜, 출석 체크, 숙제 완성도) & 테스트 결과 표 전용 테마 헤더 ★ */
        .hj-first-col, .hj-test-table th {
          background-color: var(--theme-header-bg) !important;
          color: var(--theme-header-text) !important;
          font-weight: bold;
          opacity: 0.85;
        }
        .hj-desc-text {
          font-size: 10px;
          color: #dc2626; /* 5.jpg 실물과 동일한 빨간색 안내 문구 */
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
          border: 1px solid #64748b;
          border-collapse: collapse;
          background: transparent;
        }
        .hj-feedback-box td {
          border: 1px solid #64748b;
          padding: 8px;
          font-size: 12px;
          background-color: rgba(255, 255, 255, 0.45);
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
          background-color: var(--theme-header-bg);
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
      <div className="hokma-action-bar flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-base font-black tracking-wider flex items-center gap-2 whitespace-nowrap text-slate-100">
            <Printer size={18} className="text-amber-500" /> 월간 {academyName} 일지 인쇄
          </h2>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 1. 기간 설정 그룹 */}
            <div className="flex items-center h-9 bg-slate-950 px-1 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDateMode('month')}
                  className={`px-3 py-1 rounded-md transition-all whitespace-nowrap ${
                    dateMode === 'month' ? 'bg-amber-500 text-white font-black shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  월별 선택
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('custom')}
                  className={`px-3 py-1 rounded-md transition-all whitespace-nowrap ${
                    dateMode === 'custom' ? 'bg-amber-500 text-white font-black shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  기간 지정
                </button>
              </div>

              <div className="h-4 w-px bg-slate-800 mx-1" />

              {dateMode === 'month' ? (
                <div className="flex items-center gap-2 px-2.5 whitespace-nowrap">
                  <span className="text-xs text-slate-400 font-bold">대상 월:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.val} value={opt.val} className="bg-slate-900 text-white">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2.5 text-xs font-bold whitespace-nowrap">
                  <span className="text-slate-400">기간:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-0.5 outline-none [color-scheme:dark]"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-slate-900 text-white border border-slate-700 rounded px-2 py-0.5 outline-none [color-scheme:dark]"
                  />
                </div>
              )}
            </div>

            {/* 2. 스타일 디자인 그룹 (테마 + 펜 색상) */}
            <div className="flex items-center gap-3 h-9 bg-slate-950 px-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Palette size={14} className="text-amber-400 shrink-0" />
                <span className="text-xs text-slate-400 font-bold">테마:</span>
                <select
                  value={selectedTheme}
                  onChange={(e) => setSelectedTheme(e.target.value as ThemeKey)}
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                >
                  {Object.entries(JOURNAL_THEMES).map(([key, config]) => (
                    <option key={key} value={key} className="bg-slate-900 text-white">
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-slate-800" />

              <div className="flex items-center gap-2 whitespace-nowrap">
                <Edit3 size={14} className="text-blue-400 shrink-0" />
                <span className="text-xs text-slate-400 font-bold">펜 색상:</span>
                <select
                  value={selectedPenColor}
                  onChange={(e) => setSelectedPenColor(e.target.value)}
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                >
                  {PEN_COLORS.map((col) => (
                    <option key={col.val} value={col.val} className="bg-slate-900 text-white">
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 우측 대상 학생 그룹 & 인쇄 실행 버튼 */}
        <div className="flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <label className="flex items-center gap-2 h-9 bg-slate-950 px-3 rounded-lg border border-slate-800 cursor-pointer select-none hover:bg-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={includeOtherDays}
              onChange={(e) => setIncludeOtherDays(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-900 cursor-pointer"
            />
            <span className="text-xs text-slate-200 font-bold">모든 학생 보기</span>
          </label>

          <div className="flex items-center gap-2 h-9 bg-slate-950 px-3 rounded-lg border border-slate-800">
            <Filter size={14} className="text-amber-400 shrink-0" />
            <select
              value={courseTypeFilter}
              onChange={(e) => setCourseTypeFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">전체 수업 (정규+특강)</option>
              <option value="regular" className="bg-slate-900 text-white">정규수업만 보기</option>
              <option value="special" className="bg-slate-900 text-white">선택과목(특강)만 보기</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 h-9 bg-slate-950 px-3 rounded-lg border border-slate-800">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none w-20 placeholder:text-slate-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <span className="h-9 px-3 bg-blue-950/80 border border-blue-800/80 rounded-lg text-[11px] text-blue-200 font-bold flex items-center gap-1.5 shadow-sm">
            💡 <span className="text-blue-300">숙제 완성도 셀 클릭 시 바로 수정</span>
          </span>

          <span className="h-9 px-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-bold flex items-center gap-1">
            총 <span className="text-amber-400 font-black">{printTargetItems.length}</span>개 일지
          </span>

          <button
            onClick={handlePrint}
            className="h-9 flex items-center gap-1.5 px-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black rounded-lg shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Printer size={14} /> 인쇄하기
          </button>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-slate-950 overflow-y-auto journal-preview-container">
        {printTargetItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 font-bold">
            <Filter size={32} className="mb-2 text-slate-600" />
            <p>선택 조건에 해당하는 학생 및 특강 일지가 없습니다.</p>
          </div>
        ) : (
          printTargetItems.map((item, stIdx) => {
            const { student, courseName: targetCourse, isSpecial } = item;
            let startDate: Date;
            let endDate: Date;
            let displayMonth: string;

            if (dateMode === 'custom' && customStartDate && customEndDate) {
              startDate = new Date(`${customStartDate}T00:00:00`);
              endDate = new Date(`${customEndDate}T23:59:59`);
              const startM = startDate.getMonth() + 1;
              const endM = endDate.getMonth() + 1;
              displayMonth = startM === endM ? `${startM}` : `${startM}~${endM}`;
            } else {
              const [yearStr, monthStr] = selectedMonth.split('-');
              const targetYear = parseInt(yearStr, 10);
              const targetMonthVal = parseInt(monthStr, 10);
              startDate = new Date(targetYear, targetMonthVal - 1, 1);
              endDate = new Date(targetYear, targetMonthVal, 0, 23, 59, 59);
              displayMonth = `${targetMonthVal}`;
            }

            const allSessionLogs = [...(student.allLogs || [])];
            if (student.todaySession) {
              const exists = allSessionLogs.some(l => 
                (l.date || l.session_date) === (student.todaySession?.date || student.todaySession?.session_date) &&
                ((l.course_name || '정규') === targetCourse)
              );
              if (!exists) allSessionLogs.push(student.todaySession);
            }

            // 💡 [동일 날짜 중복 제거] 7/21 같은 날짜에 '특강'과 '방학특강' 이름으로 2개의 세션 로그가 상존할 경우 1개만 보존
            const uniqueLogsMap = new Map<string, typeof allSessionLogs[0]>();
            allSessionLogs.forEach((log) => {
              const rawDateStr = (log.date || log.session_date || '').replace(/\./g, '-');
              if (!rawDateStr) return;
              const logDate = new Date(rawDateStr);
              const logCourse = log.course_name || '정규';
              
              const isTargetGeneric = ['특강', '방학특강', '선택과목'].includes(targetCourse?.trim());
              const isCourseMatch = isSpecial 
                ? (isTargetGeneric ? ['특강', '방학특강', '선택과목'].includes(logCourse.trim()) : logCourse === targetCourse)
                : (logCourse === '정규' || !log.course_name || log.course_name.trim() === '');

              if (logDate >= startDate && logDate <= endDate && isCourseMatch) {
                // 💡 [특강 기간 이중 검증] 특강 일지 인쇄 시 특강 시작일(startDate) 이전 항목은 자동 제외
                if (isSpecial) {
                  const rawElective = student.book_courses?.['__elective_courses'];
                  if (rawElective) {
                    try {
                      const courses = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
                      if (Array.isArray(courses)) {
                        const matchedCourse = courses.find((c: any) => {
                          const cSubj = c.subject?.trim() || '방학특강';
                          return ['특강', '방학특강', '선택과목'].includes(cSubj) || cSubj === targetCourse;
                        });
                        if (matchedCourse) {
                          const eStart = matchedCourse.startDate || matchedCourse.start_date;
                          const eEnd = matchedCourse.endDate || matchedCourse.end_date;
                          const logYMD = logDate.toISOString().split('T')[0];
                          if (eStart && logYMD < eStart) return;
                          if (eEnd && logYMD > eEnd) return;
                        }
                      }
                    } catch (e) {}
                  }
                }

                // 더 많은 학습 정보(수행진도/숙제 등)가 채워진 세션을 우선 채택
                if (!uniqueLogsMap.has(rawDateStr)) {
                  uniqueLogsMap.set(rawDateStr, log);
                } else {
                  const existing = uniqueLogsMap.get(rawDateStr)!;
                  const newScore = (log.completed_classwork_text ? 2 : 0) + (log.homework_text ? 2 : 0) + (log.attendance_status ? 1 : 0);
                  const oldScore = (existing.completed_classwork_text ? 2 : 0) + (existing.homework_text ? 2 : 0) + (existing.attendance_status ? 1 : 0);
                  if (newScore > oldScore) {
                    uniqueLogsMap.set(rawDateStr, log);
                  }
                }
              }
            });

            const monthLogs = Array.from(uniqueLogsMap.values())
              .sort((a, b) => {
                const dateA = new Date((a.date || a.session_date || '').replace(/\./g, '-')).getTime();
                const dateB = new Date((b.date || b.session_date || '').replace(/\./g, '-')).getTime();
                return dateA - dateB;
              });

          // 💡 [안정화] 합의된 결석(수업제외, 수업취소) 걷어내기 및 정규 수업 요일이 아니면서 비어있는 유령 세션 제거
          const validMonthLogs = monthLogs.filter((log) => {
            if (log.attendance_status && ['수업제외', '수업취소'].includes(log.attendance_status)) return false;
            
            // 💡 [유령 세션 가드] 정규 일지 출력 시, 정규 수업 요일(class_days)이 아니면서 아무 기록도 없는 빈 세션은 자동 제외
            if (!isSpecial) {
              const rawDateStr = (log.date || log.session_date || '').replace(/\./g, '-');
              const logDateObj = new Date(rawDateStr);
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const dayName = dayNames[logDateObj.getDay()];
              const isRegularClassDay = (student.class_days || []).includes(dayName);
              const hasAnyContent = isValidHistoryLog(log);

              if (!isRegularClassDay && !hasAnyContent) {
                return false; // 정규 요일도 아니고 내용도 없는 찌꺼기 세션 제거
              }
            }
            return true;
          });

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

                const rawDateKey = log.date || log.session_date || '';
                let hwScore = '';
                const overrideKey = `${student.id}_${rawDateKey}`;
                if (hwOverrides[overrideKey] !== undefined) {
                  hwScore = hwOverrides[overrideKey];
                } else if (attStatus.includes('결석')) {
                  hwScore = '-';
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
                  homeworkText = '-';
                } else if (attStatus.includes('수업제외') || attStatus.includes('수업취소')) {
                  const reason = log.attendance_reason ? ` (${log.attendance_reason})` : '';
                  classworkText = `${attStatus}${reason}`;
                  homeworkText = '-';
                }

                return {
                  dateText,
                  rawDateKey,
                  attendanceSign,
                  hwScore,
                  classworkText,
                  homeworkText
                };
              }
              return {
                dateText: '',
                rawDateKey: '',
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

                if (scoreText.includes(',,')) {
                  scoreText = scoreText.split(',,')[0].trim();
                }

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

            const isSpecial = student.isSpecialClass || (student.courseName && student.courseName !== '정규');
            const currentThemeConfig = JOURNAL_THEMES[selectedTheme];

            const pageSuffix = totalSheets > 1 ? ` (${sheetIdx + 1}/${totalSheets})` : '';

            return (
              <React.Fragment key={`${student.id}-sheet-${sheetIdx}-${stIdx}`}>
                {/* PAGE 1: 앞면 */}
                <div 
                  className="hokma-page"
                  style={{
                    position: 'relative',
                    '--theme-bg': currentThemeConfig.bg,
                    '--theme-border': currentThemeConfig.border,
                    '--theme-header-bg': currentThemeConfig.headerBg,
                    '--theme-header-text': currentThemeConfig.headerText,
                    '--theme-title-color': currentThemeConfig.titleColor,
                    '--theme-line-color': currentThemeConfig.lineColor,
                    '--theme-desc-color': currentThemeConfig.descColor,
                  } as React.CSSProperties}
                >
                  {/* 중앙 초대형 워터마크 배경 (앞페이지: 하단 배치) */}
                  {logoSrc && (
                    <div 
                      style={{ 
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: '80px',
                        pointerEvents: 'none',
                        zIndex: 0,
                        opacity: 0.13,
                        overflow: 'hidden'
                      }}
                    >
                      <img 
                        src={logoSrc} 
                        alt="Watermark Single" 
                        style={{ 
                          width: '580px',
                          maxHeight: '580px',
                          transform: 'rotate(-12deg) translateY(20px)',
                          objectFit: 'contain',
                          filter: currentThemeConfig.logoFilter
                        }} 
                      />
                    </div>
                  )}

                  {/* 상단/하단 그룹 포함 콘텐츠 Container */}
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                    <div>
                      {/* 1. 헤더 */}
                    <div className="hj-title-container">
                      <h1 className="hj-main-title">
                        {(() => {
                          const courseSubject = targetCourse && targetCourse !== '정규'
                            ? targetCourse
                            : (student.electiveCourse?.subject || '선택과목');
                          return isSpecial
                            ? `〈 나의 ${courseSubject} ${academyName} 일지${pageSuffix} 〉`
                            : `〈 나의 ${displayMonth}월 ${academyName} 일지${pageSuffix} 〉`;
                        })()}
                      </h1>
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
                      <div>이름 : <span style={{ color: currentThemeConfig.metaTextColor, fontWeight: 600 }}>{isSpecial ? `특강-${student.name}` : student.name}</span></div>
                    </div>

                    {/* 3. 출석 영역 */}
                    <h3 className="hj-section-title">1. 출석</h3>
                    <table className="hj-table">
                      <thead>
                        <tr>
                          <th className="hj-first-col" style={{ width: '15.5%' }}>수업 날짜</th>
                          {rows.map((r, i) => {
                            const globalNum = startIdx + i + 1;
                            return (
                              <th key={i} style={{ width: '6.5%' }} className="relative">
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', display: 'block', marginBottom: '1px' }}>
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
                          <th className="hj-first-col">출석 체크</th>
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
                          <th className="hj-first-col" style={{ width: '15.5%' }}>수업 날짜</th>
                          {rows.map((r, i) => {
                            const globalNum = startIdx + i + 1;
                            return (
                              <th key={i} style={{ width: '6.5%' }} className="relative">
                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', display: 'block', marginBottom: '1px' }}>
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
                          <th className="hj-first-col">숙제 완성도</th>
                          {rows.map((r, i) => (
                            <td 
                              key={i} 
                              className="hj-handwriting cursor-pointer hover:bg-amber-100/60 transition-colors select-none" 
                              style={{ fontSize: '20px' }}
                              onClick={() => r.dateText && handleToggleHwScore(student.id, r.rawDateKey, r.hwScore, targetCourse)}
                              title={r.dateText ? '클릭 시 숙제 점수 변경 (10점 -> 7점 -> 4점 -> 0점 -> -)' : ''}
                            >
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
                    <table className="hj-table hj-test-table" style={{ fontSize: '11px' }}>
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
              </div>

                {/* PAGE 2: 뒷면 */}
                <div 
                  className="hokma-page"
                  style={{
                    position: 'relative',
                    '--theme-bg': currentThemeConfig.bg,
                    '--theme-border': currentThemeConfig.border,
                    '--theme-header-bg': currentThemeConfig.headerBg,
                    '--theme-header-text': currentThemeConfig.headerText,
                    '--theme-title-color': currentThemeConfig.titleColor,
                    '--theme-line-color': currentThemeConfig.lineColor,
                    '--theme-desc-color': currentThemeConfig.descColor,
                  } as React.CSSProperties}
                >
                  {/* 중앙 초대형 워터마크 배경 */}
                  {logoSrc && (
                    <div 
                      style={{ 
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        zIndex: 0,
                        opacity: 0.13,
                        overflow: 'hidden'
                      }}
                    >
                      <img 
                        src={logoSrc} 
                        alt="Watermark Single" 
                        style={{ 
                          width: '620px',
                          maxHeight: '620px',
                          transform: 'rotate(-12deg)',
                          objectFit: 'contain',
                          filter: currentThemeConfig.logoFilter
                        }} 
                      />
                    </div>
                  )}

                  {/* 상단/하단 그룹 포함 콘텐츠 Container */}
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                    <div>
                      <h3 className="hj-section-title" style={{ fontSize: '18px', marginTop: '0', marginBottom: '3mm' }}>
                        3. 일일 진도 기록{pageSuffix}
                      </h3>
                      <table className="hj-table" style={{ fontSize: '11px' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '12%', height: '34px' }} className="hj-first-col">날 짜</th>
                            <th style={{ width: '44%' }} className="hj-first-col">오늘의 진도 (교재, 페이지)</th>
                            <th style={{ width: '44%' }} className="hj-first-col">오늘의 숙제</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => {
                            const globalNum = startIdx + i + 1;
                            return (
                              <tr key={i}>
                                <td style={{ height: '52px' }} className="relative">
                                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1f2937', display: 'block', marginBottom: '2px' }}>
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

                    {/* 하단 그룹: 한달을 돌아보며 (A4 최하단 고정 배치) */}
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
                </div>
              </React.Fragment>
            );
          });
        })
      )}
      </div>
    </div>,
    document.body
  );
}
