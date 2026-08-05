'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, UserPlus, Check, MousePointer2, MinusCircle, Calendar, TrendingUp, StickyNote, Target, ExternalLink, Search, X, Download, Upload, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, TextbookOption } from '@/types/dashboard';
import { getDayOfWeek, getTodayStr } from '@/lib/utils';
import AddStudentModal from '../AddStudentModal';

interface OverviewProps {
  todayStudents: Student[];
  excludedStudents?: Student[]; // 💡 추가
  filteredAllStudents: Student[];
  allTodayIds?: string[];
  selectedStudentId: string | null;
  onSelectStudent: (id: string) => void;
  onViewProgress?: (id: string) => void;
  selectedDate: string;
  onDateChange: (date: string) => void;
  todayKey: string;
  selectedFilter: string;
  isBatchMode: boolean;
  setIsBatchMode: (val: boolean) => void;
  onBatchAdd: (ids: string[], reasons: Record<string, string>, makeupHours: Record<string, number>) => Promise<void>;
  onRemoveFromToday: (id: string, reason: string, mode?: 'delete' | 'cancel') => Promise<void>;
  onAddNewStudent: (data: any) => Promise<void>;
  onBatchAddStudents?: (newStudents: any[]) => Promise<boolean>; // 💡 추가
  masterTextbooks: TextbookOption[];
  teachers?: any[]; 
  title?: string;
  showAddButton?: boolean;
  hideTodaySection?: boolean;
  consultationCycle?: number;
  onStartClass?: () => void;
  academyInfo?: any;
  searchQuery?: string; // 💡 추가
  onSearchChange?: (val: string) => void; // 💡 추가
  currentUser?: any; // 💡 추가
}

export default function Overview({ 
  todayStudents = [], excludedStudents = [], filteredAllStudents = [], allTodayIds = [], selectedStudentId, onSelectStudent, 
  onViewProgress,
  selectedDate, onDateChange,
  todayKey,
  selectedFilter = 'All', isBatchMode, setIsBatchMode, onBatchAdd, onRemoveFromToday, onAddNewStudent, onBatchAddStudents, masterTextbooks = [],
  teachers = [],
  title,
  showAddButton = false,
  hideTodaySection = false,
  consultationCycle = 21,
  onStartClass,
  academyInfo,
  searchQuery = '', // 💡 추가
  onSearchChange, // 💡 추가
  currentUser // 💡 추가
}: OverviewProps) {
  
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 💡 [추가] 학생 등록용 엑셀 템플릿 다운로드
  const downloadStudentTemplate = () => {
    const headers = ['이름', '학년', '학교', '반명', '학생연락처', '부모연락처', '코스', '수업요일', '담당교사'];
    const sampleRow = ['홍길동', '초5', '호크마초등학교', '경시반', '010-1234-5678', '010-9876-5432', 'C', '월수금', '한송이'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    ws['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생일괄등록");
    XLSX.writeFile(wb, `학생일괄등록_양식.xlsx`);
  };

  // 💡 [추가] 학생 엑셀 일괄 등록 파서
  const handleImportStudents = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        if (rows.length < 2) {
          alert('엑셀 파일에 등록할 학생 정보가 없습니다.');
          return;
        }
        
        const headers: any = rows[0];
        const nameIdx = headers.indexOf('이름');
        const gradeIdx = headers.indexOf('학년');
        const schoolIdx = headers.indexOf('학교');
        const classNameIdx = headers.indexOf('반명');
        const phoneIdx = headers.indexOf('학생연락처') !== -1 ? headers.indexOf('학생연락처') : headers.indexOf('연락처');
        const parentPhoneIdx = headers.indexOf('부모연락처');
        const courseIdx = headers.indexOf('코스');
        const daysIdx = headers.indexOf('수업요일');
        const teacherIdx = headers.indexOf('담당교사');
        
        if (nameIdx === -1) {
          alert("올바른 양식이 아닙니다. '이름' 열이 필수로 존재해야 합니다.");
          return;
        }
        
        const newStudentsPayload: any[] = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row: any = rows[i];
          if (!row || row.length === 0) continue;
          
          const rawName = String(row[nameIdx] || '').trim();
          if (!rawName) continue;
          
          const rawDays = daysIdx !== -1 ? String(row[daysIdx] || '').trim() : '';
          
          const cleanedDays: string[] = [];
          if (rawDays) {
            const allDaysList = ['월', '화', '수', '목', '금', '토', '일'];
            allDaysList.forEach(d => {
              if (rawDays.includes(d)) cleanedDays.push(d);
            });
          }
          
          const daySchedules: Record<string, number[]> = {};
          cleanedDays.forEach(d => {
            daySchedules[d] = [1600, 1900];
          });
          
          let studentPhoneVal = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : '';
          if (studentPhoneVal) {
            studentPhoneVal = studentPhoneVal.replace(/[^0-9]/g, '');
            if (studentPhoneVal.length === 11) {
              studentPhoneVal = studentPhoneVal.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
            } else if (studentPhoneVal.length === 10) {
              studentPhoneVal = studentPhoneVal.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
            }
          }

          let parentPhoneVal = parentPhoneIdx !== -1 ? String(row[parentPhoneIdx] || '').trim() : '';
          if (parentPhoneVal) {
            parentPhoneVal = parentPhoneVal.replace(/[^0-9]/g, '');
            if (parentPhoneVal.length === 11) {
              parentPhoneVal = parentPhoneVal.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
            } else if (parentPhoneVal.length === 10) {
              parentPhoneVal = parentPhoneVal.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
            }
          }

          const combinedPhone = parentPhoneVal ? `${studentPhoneVal} (부모: ${parentPhoneVal})` : studentPhoneVal;
          
          // 💡 부모연락처(숫자만 남긴 것)에서 뒷 4자리를 추출하여 학부모 로그인 비밀번호 뒷자리(login_suffix)로 자동 매핑!
          let loginSuffixVal = null;
          const parentDigits = parentPhoneVal.replace(/[^0-9]/g, '');
          if (parentDigits.length >= 4) {
            loginSuffixVal = parentDigits.substring(parentDigits.length - 4);
          }

          const rawTeacherName = teacherIdx !== -1 ? String(row[teacherIdx] || '').trim() : '';
          let matchedTeacherId = null;
          if (rawTeacherName && teachers && teachers.length > 0) {
            const matched = teachers.find(t => t.name.trim() === rawTeacherName || t.nickname?.trim() === rawTeacherName);
            if (matched) matchedTeacherId = matched.id;
          }
          
          newStudentsPayload.push({
            name: rawName,
            grade: gradeIdx !== -1 ? String(row[gradeIdx] || '').trim() : '미지정',
            school: schoolIdx !== -1 ? String(row[schoolIdx] || '').trim() : '',
            class_name: classNameIdx !== -1 ? String(row[classNameIdx] || '').trim() : '',
            phone: combinedPhone,
            login_suffix: loginSuffixVal,
            teacher_id: matchedTeacherId,
            course: (courseIdx !== -1 && String(row[courseIdx]).trim()) ? String(row[courseIdx]).trim() : 'C',
            class_days: cleanedDays,
            day_schedules: daySchedules,
            assigned_books: [],
            book_courses: {}
          });
        }
        
        if (newStudentsPayload.length === 0) {
          alert('등록 가능한 학생 데이터가 없습니다.');
          return;
        }
        
        if (onBatchAddStudents) {
          const isSuccess = await onBatchAddStudents(newStudentsPayload);
          if (isSuccess) {
            alert(`성공적으로 총 ${newStudentsPayload.length}명의 학생이 한 번에 등록되었습니다!`);
          }
        }
      } catch (err: any) {
        console.error(err);
        alert('학생 엑셀 파일 파싱 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };
  
  const [reasonModal, setReasonModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'remove';
    studentIds: string[];
  }>({ isOpen: false, type: 'add', studentIds: [] });

  // 모달 ESC 키 닫기 이벤트
  useEffect(() => {
    if (reasonModal.isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setReasonModal(prev => ({ ...prev, isOpen: false }));
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [reasonModal.isOpen]);
  
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [makeupHours, setMakeupHours] = useState<Record<string, number>>({});

  const isArchiveMode = useMemo(() => selectedFilter?.toLowerCase() === 'discharged', [selectedFilter]);

  const studentsToDisplay = useMemo(() => {
    if (isArchiveMode) {
      return filteredAllStudents || [];
    } else {
      return (filteredAllStudents || []).filter(s => !allTodayIds.includes(s.id));
    }
  }, [filteredAllStudents, allTodayIds, isArchiveMode]);

  const toggleSelection = (id: string) => {
    setSelectedForBatch(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleRemoveSelection = (id: string) => {
    setSelectedToRemove(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleApplyBatch = () => {
    if (selectedForBatch.length > 0) {
      const initialReasons: Record<string, string> = {};
      const initialHours: Record<string, number> = {};
      
      const settings = academyInfo?.operation_settings || {};
      const baseTime = settings.first_period_time || "";
      const baseHour = baseTime ? parseInt(baseTime.split(':')[0]) : 15;

      selectedForBatch.forEach(id => { 
        initialReasons[id] = '보강 수업'; 
        
        const s = studentsToDisplay.find(student => student.id === id);
        const activeHours = s?.day_schedules?.[todayKey] || [];
        let defaultHour = baseHour;
        if (activeHours.length > 0) {
          defaultHour = Math.min(...activeHours.map((h: number) => h >= 1000 ? Math.floor(h / 100) : (h % 100)));
        }
        initialHours[id] = defaultHour;
      });
      
      setReasons(initialReasons);
      setMakeupHours(initialHours);
      setReasonModal({
        isOpen: true,
        type: 'add',
        studentIds: selectedForBatch
      });
      return;
    }

    if (selectedToRemove.length > 0) {
      const initialReasons: Record<string, string> = {};
      selectedToRemove.forEach(id => { initialReasons[id] = '수업 취소'; });
      
      setReasons(initialReasons);
      setReasonModal({
        isOpen: true,
        type: 'remove',
        studentIds: selectedToRemove
      });
    }
  };

  const confirmReason = async () => {
    if (reasonModal.type === 'add') {
      await onBatchAdd(reasonModal.studentIds, reasons, makeupHours);
      setSelectedForBatch([]);
    } else {
      await Promise.all(reasonModal.studentIds.map(id => onRemoveFromToday(id, reasons[id] || '수업 취소')));
      setSelectedToRemove([]);
    }
    
    setReasonModal({ ...reasonModal, isOpen: false });
    setReasons({});
    setMakeupHours({});
    setIsBatchMode(false);
  };

  const updateIndividualReason = (id: string, text: string) => {
    setReasons(prev => ({ ...prev, [id]: text }));
  };

  const updateIndividualHour = (id: string, hour: number) => {
    setMakeupHours(prev => ({ ...prev, [id]: hour }));
  };

  const getStudentName = (id: string) => {
    return studentsToDisplay.find(s => s.id === id)?.name || todayStudents.find(s => s.id === id)?.name || 'Student';
  };

  // 💡 학년별 학생 수 통계 복구
  const getGradeStats = (studentList: Student[]) => {
    const stats: Record<string, number> = {};
    const grades = ['초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
    grades.forEach(g => stats[g] = 0);
    studentList.forEach(s => {
      const g = s.grade || '';
      if (stats[g] !== undefined) stats[g]++;
    });
    return Object.entries(stats).filter(([_, count]) => count > 0);
  };

  const todayGradeStats = useMemo(() => getGradeStats(todayStudents), [todayStudents]);
  const otherGradeStats = useMemo(() => getGradeStats(studentsToDisplay), [studentsToDisplay]);

  return (
    <div className="p-2 space-y-6 relative">
      {!isArchiveMode && !hideTodaySection && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
                  {todayKey === getDayOfWeek(getTodayStr()) ? "Today's Schedule" : `${todayKey}요일 Schedule`}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#37352f]/80 bg-[#f8f8f7] px-2 py-1 rounded-[2px] border border-[#edece9] uppercase font-black tracking-tight">
                    <span className="text-amber-600 font-bold">{todayStudents.length}</span> Students
                  </span>
                  {todayGradeStats.map(([grade, count], idx) => {
                    const isES = grade.includes('초');
                    const isMS = grade.includes('중');
                    const isHS = grade.includes('고');
                    const colorClass = isES ? 'text-emerald-600' : isHS ? 'text-amber-600' : 'text-blue-600';
                    return (
                      <div key={grade || idx} className="flex items-center gap-1.5 bg-[#f8f8f7] border border-[#edece9] px-2 py-1 rounded-[2px] shadow-sm">
                        <span className="text-[10px] font-bold text-[#37352f]/80 uppercase">{grade}</span>
                        <span className={`text-[10px] font-black ${colorClass}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>

              </div>

              <div className="flex items-center gap-2">
                <div 
                  onClick={(e) => {
                    const input = e.currentTarget.querySelector('input');
                    if (input && 'showPicker' in input) {
                      try { (input as any).showPicker(); } catch (err) { console.error(err); }
                    }
                  }}
                  className="flex items-center gap-2 bg-[#f8f8f7] border border-[#edece9] rounded-[2px] px-3 py-1 text-[#37352f]/85 hover:bg-[#efeeee] transition-all group/date relative cursor-pointer"
                >
                  <Calendar size={12} className="group-hover/date:text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-tighter">
                    {selectedDate.replace(/-/g, '.')}
                  </span>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer [color-scheme:light] z-10"
                  />
                </div>
              </div>
            </div>

            {isBatchMode && (
              <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest animate-pulse px-1">
                💡 Click to remove from today&apos;s list
              </p>
            )}
          </div>
 
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 pt-1">
            {todayStudents.map((s, idx) => {
              const isChecked = selectedToRemove.includes(s.id);
              return (
                <StudentRowItem
                  key={s.id || idx}
                  student={s}
                  isSelected={selectedStudentId === s.id && !isBatchMode}
                  isChecked={isChecked}
                  isBatchMode={isBatchMode}
                  currentDay={todayKey}
                  masterTextbooks={masterTextbooks}
                  onViewProgress={onViewProgress}
                  consultationCycle={consultationCycle}
                  onClick={() => isBatchMode ? toggleRemoveSelection(s.id) : onSelectStudent(s.id)}
                  academyInfo={academyInfo}
                  onRemoveFromToday={onRemoveFromToday}
                />
              );
            })}
            {todayStudents.length === 0 && (
              <div className="col-span-full p-8 rounded-[2px] bg-[#f8f8f7] border border-dashed border-[#edece9] text-center text-[#37352f]/60 font-bold uppercase tracking-widest text-[10px]">No classes scheduled</div>
            )}
          </div>
        </section>
      )}
 
      {/* 💡 [추가] 오늘 수업 제외(취소)된 학생 목록 */}
      {!hideTodaySection && excludedStudents && excludedStudents.length > 0 && (
        <section className="space-y-2 pt-4 border-t border-[#edece9]">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2 px-1">
            <MinusCircle size={14} /> 오늘 수업 제외 학생 ({excludedStudents.length}명)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 pt-1">
            {excludedStudents.map((s, idx) => (
              <StudentRowItem
                key={s.id || idx}
                student={s}
                isSelected={selectedStudentId === s.id && !isBatchMode}
                isChecked={selectedForBatch.includes(s.id)}
                isBatchMode={isBatchMode}
                currentDay={todayKey}
                masterTextbooks={masterTextbooks}
                onViewProgress={onViewProgress}
                consultationCycle={consultationCycle}
                onClick={() => isBatchMode ? toggleSelection(s.id) : onSelectStudent(s.id)}
                academyInfo={academyInfo}
                onRemoveFromToday={onRemoveFromToday}
              />
            ))}
          </div>
        </section>
      )}

      <section className={`space-y-2 ${(todayStudents.length > 0 || excludedStudents.length > 0) ? 'pt-4 border-t border-[#edece9]' : ''}`}>
        <div className={`sticky top-[-8px] z-40 bg-white/95 backdrop-blur-sm pb-4 pt-2 -mx-2 px-3 border-b border-[#edece9]`}>
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#37352f] flex items-center gap-2">
                <Users size={14} /> 
                {title ? title : (isArchiveMode ? 'Discharged Students Archive' : 'Rest of Students')}
              </h3>
              {!isArchiveMode && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-[#37352f]/85 bg-[#f8f8f7] px-2 py-1 rounded-[2px] border border-[#edece9] uppercase font-black tracking-tight">
                    <span className="text-amber-600 font-bold">{studentsToDisplay.length}</span> Students
                  </span>
                  {otherGradeStats.map(([grade, count], idx) => {
                    const isES = grade.includes('초');
                    const isMS = grade.includes('중');
                    const isHS = grade.includes('고');
                    const colorClass = isES ? 'text-emerald-600' : isHS ? 'text-amber-600' : 'text-blue-600';
                    return (
                      <div key={grade || idx} className="flex items-center gap-1.5 bg-[#f8f8f7] border border-[#edece9] px-2 py-1 rounded-[2px] shadow-sm">
                        <span className="text-[10px] font-bold text-[#37352f]/80 uppercase">{grade}</span>
                        <span className={`text-[10px] font-black ${colorClass}`}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {!isBatchMode && !isArchiveMode && showAddButton && (
                <div className="flex gap-2">
                  {hideTodaySection && (
                    <>
                      <button 
                        onClick={downloadStudentTemplate}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase tracking-widest bg-[#f8f8f7] text-[#37352f]/60 hover:bg-[#efeeee] hover:text-[#37352f] transition-all border border-[#edece9]"
                        title="대량 등록용 엑셀 템플릿 다운로드"
                      >
                        <Download size={10} /> 양식 다운로드
                      </button>

                      <input 
                        type="file" 
                        id="excel-students-bulk-input" 
                        accept=".xlsx, .xls" 
                        onChange={handleImportStudents} 
                        className="hidden" 
                      />
                      <button 
                        onClick={() => document.getElementById('excel-students-bulk-input')?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white transition-all border border-purple-200"
                        title="엑셀 작성본 업로드하여 학생 일괄 등록"
                      >
                        <Upload size={10} /> 엑셀 일괄 등록
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200"
                  >
                    <UserPlus size={10} /> 신규 학생 등록
                  </button>
                </div>
              )}
              
              {isBatchMode && (
                <button 
                  onClick={() => { setIsBatchMode(false); setSelectedForBatch([]); setSelectedToRemove([]); }}
                  className="px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase bg-[#f8f8f7] text-[#37352f]/60 hover:bg-[#efeeee] hover:text-[#37352f] transition-all"
                >
                  Cancel
                </button>
              )}
              
              {!isArchiveMode && !hideTodaySection && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => isBatchMode ? handleApplyBatch() : setIsBatchMode(true)}
                    className={`flex items-center gap-2 px-6 py-3.5 rounded-[4px] text-[13px] font-black uppercase tracking-widest transition-all duration-200 ${
                      isBatchMode 
                        ? 'bg-[#0c73e8] text-white shadow-xl shadow-blue-500/10 border-2 border-blue-400 animate-pulse' 
                        : 'bg-[#0c73e8] text-white hover:bg-[#0b66ce] hover:scale-[1.04] active:scale-[0.96] border-2 border-blue-600/40 shadow-md'
                    }`}
                  >
                    {isBatchMode ? (
                      <><Check size={14} strokeWidth={3} /> {selectedForBatch.length + selectedToRemove.length} Confirm</>
                    ) : (
                      <><Users size={14} strokeWidth={3} /> 오늘 수업 변경</>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 💡 [추가] 학생 정보 수정 모드('전체 학생 정보 관리')에서만 노출되는 검색창 */}
          {hideTodaySection && onSearchChange && (
            <div className="mt-4 relative group max-w-md px-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-blue-500 transition-colors" size={14} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="찾으실 학생 이름을 입력하세요..."
                className="w-full bg-white border border-[#edece9] rounded-[2px] py-2.5 pl-10 pr-10 text-xs text-[#37352f] placeholder:text-[#37352f]/45 focus:bg-[#fbfbfa] focus:border-[#0c73e8] outline-none transition-all font-bold shadow-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => onSearchChange('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <AnimatePresence>
          {isBatchMode && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
              className="bg-blue-600/5 border border-blue-500/10 p-2 rounded-[2px] flex items-center justify-center gap-2 text-blue-400 font-bold text-[9px] uppercase tracking-widest"
            >
              <MousePointer2 size={10} className="animate-pulse" /> Select students and click confirm
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 pt-1">
          {studentsToDisplay.map((s, idx) => {
            const isChecked = selectedForBatch.includes(s.id);
            return (
              <StudentRowItem 
                key={s.id || idx} 
                student={s} 
                isSelected={selectedStudentId === s.id && !isBatchMode} 
                isChecked={isChecked}
                isBatchMode={isBatchMode}
                currentDay={todayKey}
                masterTextbooks={masterTextbooks}
                onViewProgress={onViewProgress}
                consultationCycle={consultationCycle}
                academyInfo={academyInfo}
                onClick={() => isBatchMode ? toggleSelection(s.id) : onSelectStudent(s.id)} 
                onRemoveFromToday={onRemoveFromToday}
              />
            );
          })}
          {studentsToDisplay.length === 0 && (
             <div className="p-10 text-center text-[#37352f]/60 text-[10px] font-bold uppercase tracking-widest border border-dashed border-[#edece9] rounded-sm w-full col-span-full">
               {isArchiveMode ? 'No discharged students found' : 'All students are in today\'s list'}
             </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {reasonModal.isOpen && (() => {
          const configM = (academyInfo?.operation_settings?.first_period_time || "00:00").split(':')[1] || "00";
          const displayMinute = configM.toString().padStart(2, '0');
          const hourOptions = Array.from({ length: 13 }, (_, i) => i + 10); // 10시 ~ 22시
          
          const handleBatchHourChange = (hour: number) => {
            const updated = { ...makeupHours };
            reasonModal.studentIds.forEach(id => {
              updated[id] = hour;
            });
            setMakeupHours(updated);
          };

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/20 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white border border-[#edece9] p-6 rounded-sm max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reasonModal.type === 'add' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                    {reasonModal.type === 'add' ? <Users size={20} /> : <MinusCircle size={20} />}
                  </div>
                  <div>
                    <h4 className="text-[#37352f] font-black text-sm uppercase">{reasonModal.type === 'add' ? '오늘 수업 변경' : '오늘 수업 제외'}</h4>
                    <p className="text-[10px] text-[#37352f]/50 font-bold">{reasonModal.studentIds.length} 명의 학생 선택됨</p>
                  </div>
                </div>

                {reasonModal.type === 'add' && (
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-[2px] space-y-1.5">
                    <label className="text-[9px] font-black uppercase text-blue-600 tracking-widest block">보강 시간 일괄 지정</label>
                    <select 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) handleBatchHourChange(parseInt(val));
                      }}
                      className="w-full bg-white border border-[#edece9] rounded-[2px] px-3 py-2 text-[11px] font-black text-amber-600 outline-none focus:border-[#0c73e8] transition-all cursor-pointer"
                    >
                      <option value="">교시를 선택하세요 (일괄 적용)</option>
                      {hourOptions.map(h => (
                        <option key={h} value={h} className="bg-white text-[#37352f]">
                          {h >= 12 
                            ? (h === 12 ? `오후 12시 ${displayMinute}분` : `오후 ${h - 12}시 ${displayMinute}분`)
                            : `오전 ${h}시 ${displayMinute}분`
                          }
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar-v">
                  <label className="text-[9px] font-black uppercase text-[#37352f]/40 tracking-widest px-1 block mb-1">학생별 사유 및 시간 입력</label>
                  {reasonModal.studentIds.map((id) => (
                    <div key={id} className="space-y-2 bg-[#f8f8f7] p-3 rounded-[2px] border border-[#edece9]">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[11px] font-black text-[#37352f]">{getStudentName(id)}</span>
                      </div>
                      
                      <div className={reasonModal.type === 'add' ? "grid grid-cols-2 gap-2" : "w-full"}>
                        <div className="space-y-1">
                          {reasonModal.type === 'add' && <label className="text-[8px] font-bold uppercase text-[#37352f]/40 tracking-widest px-0.5 block">보강 사유</label>}
                          <input 
                            type="text" 
                            value={reasons[id] || ''} 
                            onChange={(e) => updateIndividualReason(id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && confirmReason()}
                            placeholder="사유를 입력하세요"
                            className="w-full bg-white border border-[#edece9] rounded-[2px] px-3 py-2 text-[11px] font-bold text-[#37352f] outline-none focus:border-[#0c73e8] transition-all"
                          />
                        </div>
                        
                        {reasonModal.type === 'add' && (
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold uppercase text-[#37352f]/40 tracking-widest px-0.5 block">보강 시간</label>
                            <select 
                              value={makeupHours[id] || 15}
                              onChange={(e) => updateIndividualHour(id, parseInt(e.target.value))}
                              className="w-full bg-white border border-[#edece9] rounded-[2px] px-3 py-2 text-[11px] font-bold text-amber-600 outline-none focus:border-[#0c73e8] transition-all cursor-pointer"
                            >
                              {hourOptions.map(h => (
                                <option key={h} value={h} className="bg-white text-[#37352f]">
                                  {h >= 12 
                                    ? (h === 12 ? `오후 12:${displayMinute}` : `오후 ${h - 12}:${displayMinute}`)
                                    : `오전 ${h}:${displayMinute}`
                                  }
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                 <div className="flex gap-2 pt-2">
                   <button 
                     onClick={() => setReasonModal({ ...reasonModal, isOpen: false })} 
                     className="flex-1 py-3 bg-[#f8f8f7] text-[#37352f]/60 rounded-[2px] text-[10px] font-black uppercase hover:bg-[#efeeee] transition-all"
                   >
                     취소
                   </button>
                   <button 
                     onClick={confirmReason}
                     className={`flex-1 py-3 rounded-[2px] text-[10px] font-black uppercase shadow-lg transition-all ${
                       reasonModal.type === 'add' 
                         ? 'bg-[#0c73e8] text-white shadow-blue-500/10 hover:bg-[#0b66ce]' 
                         : 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-500'
                     }`}
                   >
                     확인
                   </button>
                 </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <AnimatePresence>
        {isAddModalOpen && (
          <AddStudentModal
            onClose={() => setIsAddModalOpen(false)}
            onSave={onAddNewStudent}
            masterTextbooks={masterTextbooks}
            teachers={teachers}
            currentUser={currentUser}
          />
        )}      </AnimatePresence>
    </div>
  );
}

function StudentRowItem({ 
  student, isSelected, isChecked, isBatchMode, onClick, onViewProgress, currentDay, masterTextbooks, consultationCycle = 21, academyInfo, onRemoveFromToday
}: { 
  student: Student, isSelected: boolean, isChecked?: boolean, isBatchMode: boolean, onClick: () => void, onViewProgress?: (id: string) => void, currentDay?: string, masterTextbooks: TextbookOption[], consultationCycle?: number, academyInfo?: any, onRemoveFromToday?: (id: string, reason: string, mode?: 'delete' | 'cancel') => Promise<void>
}) {
  const isSelectionMode = isBatchMode && isChecked !== undefined;
  const isMakeup = student.todaySession?.attendance_status?.startsWith('보강');
  const isAbsent = student.todaySession?.attendance_status === '결석';
  
  const settings = academyInfo?.operation_settings || {};
  const baseTime = settings.first_period_time || "";
  const baseHour = baseTime ? parseInt(baseTime.split(':')[0]) : 99; // 최후의 보루

  // 💡 정기 상담 알림 로직 (단계별 색상)
  const consultationStatus = useMemo(() => {
    if (!student.last_consulted_at) return { needs: true, color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/20' };
    
    const lastDate = new Date(student.last_consulted_at);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 35) return { needs: true, color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/20' }; // 5주 이상: 빨강
    if (diffDays >= 28) return { needs: true, color: 'text-amber-500', bg: 'bg-amber-500/20', border: 'border-amber-500/20' }; // 4주 이상: 노랑
    if (diffDays >= 21) return { needs: true, color: 'text-emerald-500', bg: 'bg-emerald-500/20', border: 'border-emerald-500/20' }; // 3주 이상: 초록
    
    return { needs: false };
  }, [student.last_consulted_at]);

    const handleCardClick = (e: React.MouseEvent) => {
      try {
        onClick();
      } catch (err) {
        console.error('Card click execution error:', err);
      }
    };

    return (
      <motion.div 
        layout 
        onClick={handleCardClick}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }}
        className={`flex items-center justify-between p-2.5 rounded-[2px] border cursor-pointer transition-all duration-300 group ${
        isSelected || isChecked ? 'bg-blue-600 border-blue-400 shadow-lg text-white' : 
        isBatchMode 
          ? isSelectionMode 
            ? 'hover:border-blue-500/50 hover:bg-blue-500/5 bg-white border-[#edece9]' 
            : 'hover:border-red-500/50 hover:bg-red-500/5 bg-white border-[#edece9]'
          : isMakeup 
            ? 'bg-emerald-500/15 border-emerald-500/40 hover:border-emerald-500/60 hover:bg-emerald-500/20'
            : isAbsent
              ? 'bg-red-500/15 border-red-500/30 opacity-[0.75] hover:opacity-95 hover:border-red-500/20'
              : 'bg-white border-[#edece9] hover:border-blue-500/50 hover:bg-[#fbfbfa]'
      }`}
    >
      <div className="flex flex-col gap-1 overflow-hidden flex-1">
        <div className="flex items-center gap-2 overflow-hidden">
          <h4 className={`text-[13px] tracking-tight shrink-0 ${
            isSelected || isChecked 
              ? 'text-white font-semibold' 
              : isBatchMode 
                ? (isSelectionMode ? 'group-hover:text-blue-400 font-semibold' : 'group-hover:text-red-400 font-semibold') 
                : isAbsent
                  ? 'text-black font-black'
                  : 'text-[#37352f] font-semibold'
          }`}>
            {student.name}
          </h4>
          {consultationStatus.needs && !isBatchMode && (
            <span className={`${consultationStatus.bg} ${consultationStatus.color} ${consultationStatus.border} text-[8px] font-black px-1 py-0.5 rounded border uppercase tracking-tighter shrink-0 animate-pulse`}>
              상담
            </span>
          )}
          {!isBatchMode && (
            <div className="flex items-center gap-1">
              {onViewProgress && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewProgress(student.id);
                  }}
                  className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-[#0c73e8] hover:text-white transition-all shadow-sm"
                  title="진도표 바로가기"
                >
                  <TrendingUp size={10} />
                </button>
              )}
              {/* 💡 학생 포털 바로가기 추가 */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  const slug = window.location.pathname.split('/')[1];
                  window.open(`/${slug}/student?id=${student.id}`, '_blank');
                }}
                className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                title="학생 페이지 보기"
              >
                <ExternalLink size={10} strokeWidth={3} />
              </button>
              {/* 💡 오늘 수업 제외/삭제 버튼 추가 */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromToday?.(student.id, '수업 취소', 'delete');
                }}
                className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                title="오늘 수업 제외/삭제"
              >
                <Trash2 size={10} />
              </button>
            </div>
          )}
          {isMakeup && !isSelected && !isChecked && (
            student.isScheduledToday ? (
              <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-200 uppercase tracking-tighter shrink-0">
                이동
              </span>
            ) : (
              <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-tighter shrink-0">
                보강
              </span>
            )
          )}
          {isAbsent && !isSelected && !isChecked && (
            <span 
              className="bg-red-50 text-red-650 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-tighter shrink-0 cursor-help"
              title={student.todaySession?.attendance_reason || '결석 사유 미기입'}
            >
              결석 {student.todaySession?.attendance_reason ? `(${student.todaySession.attendance_reason})` : ''}
            </span>
          )}
          <span className={`text-[10px] font-black truncate ${isSelected || isChecked ? 'text-blue-100' : 'text-[#37352f]'}`}>
            {student.grade} · {student.course} · {student.class}
          </span>

          {/* 💡 주의사항 및 미션 인디케이터 (Hover 시 내용 노출) */}
          <div className="flex items-center gap-1.5 ml-1">
            {student.management_notes && (
              <div className="relative group/tooltip">
                <StickyNote size={12} className="text-amber-600 opacity-80 group-hover/tooltip:opacity-100 transition-opacity" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-amber-100 text-amber-900 text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 border border-amber-200">
                  <div className="flex items-center gap-1 mb-1 border-b border-amber-900/10 pb-1 text-[8px] uppercase tracking-tighter opacity-60"><StickyNote size={8} /> Teacher's Note</div>
                  <div className="whitespace-pre-wrap leading-tight">{student.management_notes}</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-amber-100" />
                </div>
              </div>
            )}
            {student.recent_mission && (
              <div className="relative group/tooltip">
                <Target size={12} className="text-blue-600 opacity-80 group-hover/tooltip:opacity-100 transition-opacity" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-blue-600 text-white text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 border border-blue-400/30">
                  <div className="flex items-center gap-1 mb-1 border-b border-white/20 pb-1 text-[8px] uppercase tracking-tighter opacity-60"><Target size={8} /> Current Mission</div>
                  <div className="whitespace-pre-wrap leading-tight">{student.recent_mission}</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-blue-600" />
                </div>
              </div>
            )}
          </div>
        </div>

        {(student.assigned_books || []).length > 0 && (
          <div className="flex flex-wrap gap-1 items-center">
            {(student.assigned_books || []).filter(code => {
              const bookCourse = student.book_courses?.[code];
              return !!code && !String(bookCourse).includes('-keep') && !String(bookCourse).includes('-done');
            }).map((code, idx) => {
              const book = (masterTextbooks || []).find(m => m.bookcode === code);
              if (!book) return null;
              return (
                <span key={`${code}-${idx}`} className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold truncate max-w-[100px] ${
                  isSelected || isChecked ? 'bg-white/20 text-white' : 'bg-[#f8f8f7] text-[#37352f] border border-[#edece9]'
                }`}>
                  {book.title}
                </span>
              );
            })}
            {/* 💡 Keep 중인 교재 수 표시 (밝은 노랑 배경/글씨로 시인성 극대화) */}
            {(() => {
              const keepCount = (student.assigned_books || []).filter(code => String(student.book_courses?.[code]).includes('-keep')).length;
              if (keepCount === 0) return null;
              return (
                <span className="text-[7.5px] font-black px-1 py-0.5 rounded-[2px] tracking-tighter uppercase bg-yellow-400 text-black border border-yellow-300 shadow-sm leading-none">
                  {keepCount}K
                </span>
              );
            })()}
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-0.5">
          {(student.class_days || []).slice().sort((a, b) => {
            const order = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
            return (order[a as keyof typeof order] || 0) - (order[b as keyof typeof order] || 0);
          }).map(day => {
            const activeHours = student.day_schedules?.[day] || [];
            const isToday = day === currentDay;
            
            return (
              <div key={day} className={`flex items-center gap-0.5 px-1 py-0.5 rounded-md ${isToday ? 'bg-[#edece9] ring-1 ring-[#edece9]' : ''}`}>
                <span className={`text-[10px] mr-0.5 font-bold ${isToday ? 'text-emerald-700 font-black' : 'text-[#37352f]'}`}>{day}</span>
                {activeHours.length > 0 ? (
                  (() => {
                    const firstVal = activeHours[0];
                    let h = 0;
                    let m = 0;
                    
                    if (firstVal >= 100) {
                      h = Math.floor(firstVal / 100);
                      m = firstVal % 100;
                    } else {
                      h = firstVal;
                      m = 0;
                    }
                    if (h <= 12) h += 12;
                    
                    let displayH = h > 12 ? h - 12 : h;
                    if (displayH === 0) displayH = 12;
                    
                    const timeStr = m === 0 ? `${displayH}시` : `${displayH}시 ${m}분`;
                    
                    const isSpecialTime = h === 13;
                    const isLateTime = h >= 19;
                    let colorClass = '';
                    
                    if (isSpecialTime) {
                      colorClass = isToday ? 'text-emerald-700 font-black' : 'text-emerald-600';
                    } else if (isLateTime) {
                      colorClass = isToday ? 'text-amber-700 font-black' : 'text-amber-600';
                    } else {
                      colorClass = isToday ? 'text-blue-700 font-black' : 'text-blue-600';
                    }

                    return (
                      <span className={`text-[10px] font-black leading-none ${colorClass}`}>
                        {timeStr}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-[10px] font-bold text-[#37352f]">-</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {isBatchMode ? (
          isSelectionMode ? (
            isChecked ? (
              <div className="bg-white text-blue-600 p-0.5 rounded-full shadow-lg">
                <Check size={10} strokeWidth={4} />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-black/20 group-hover:border-[#0c73e8] transition-colors" />
            )
          ) : (
            <MinusCircle size={14} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )
        ) : (
          <>
            <div className="flex gap-0.5">
              {(student.history || []).map((status, i) => (
                <div key={i} className={`w-1 h-1 rounded-full ${(status as any) === 'perfect' ? 'bg-emerald-500' : (status as any) === 'good' ? 'bg-emerald-400' : (status as any) === 'warning' || (status as any) === 'neutral' ? 'bg-amber-500' : (status as any) === 'poor' || (status as any) === 'late' ? 'bg-orange-500' : (status as any) === 'bad' ? 'bg-red-500' : 'bg-black/10'}`} />
              ))}
            </div>
            <ChevronRight size={12} className={isSelected ? 'text-white' : 'text-[#37352f]/60'} />
          </>
        )}
      </div>
    </motion.div>
  );
}
