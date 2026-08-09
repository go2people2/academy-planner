import * as XLSX from 'xlsx';
import { Student } from '@/types/dashboard';

// 엑셀 템플릿 다운로드 유틸리티
export const downloadStudentTemplate = () => {
  const headers = ['이름', '학년', '학교', '반명', '학생연락처', '부모연락처', '코스', '수업요일', '수업시작시간', '수업시간(시수)', '담당교사'];
  const sampleRow = ['홍길동', '초5', '호크마초등학교', '삼산-Y', '010-1234-5678', '010-9876-5432', 'C', '월수금', '19:00', '3', '윤여태'];
  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  ws['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "학생일괄등록");
  XLSX.writeFile(wb, `학생일괄등록_양식.xlsx`);
};

// 학생 중복 전화번호 탐지 유틸리티
export const detectDuplicatePhoneStudents = (filteredAllStudents: Student[]) => {
  if (!filteredAllStudents || filteredAllStudents.length === 0) return [];
  
  const groupMap: Record<string, Student[]> = {};
  filteredAllStudents.forEach(s => {
    if (s.is_deleted) return;
    const cleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 4) {
      const last4 = cleanPhone.slice(-4);
      if (!groupMap[last4]) groupMap[last4] = [];
      groupMap[last4].push(s);
    }
  });

  const duplicates: { last4: string; students: Student[] }[] = [];
  Object.entries(groupMap).forEach(([last4, list]) => {
    if (list.length > 1) {
      const suffixes = list.map(s => (s as any).login_suffix || '');
      const hasEmptySuffix = suffixes.some(s => s === '');
      const hasDuplicateSuffix = suffixes.filter((item, index) => suffixes.indexOf(item) !== index).length > 0;

      if (hasEmptySuffix || hasDuplicateSuffix) {
        duplicates.push({ last4, students: list });
      }
    }
  });

  return duplicates;
};
