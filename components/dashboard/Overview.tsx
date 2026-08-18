'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronRight, UserPlus, Check, MousePointer2, MinusCircle, Calendar, TrendingUp, StickyNote, Target, ExternalLink, Search, X, Download, Upload, Trash2, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, TextbookOption } from '@/types/dashboard';
import { getDayOfWeek, getTodayStr } from '@/lib/utils';
import AddStudentModal from './AddStudentModal';

export interface OverviewProps {
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
  onBatchAdd: (ids: string[], reasons: Record<string, string>, makeupHours: Record<string, number>, makeupCourses?: Record<string, string>) => Promise<void>;
  onRemoveFromToday: (id: string, reason: string, mode?: 'delete' | 'cancel') => Promise<void>;
  onAddNewStudent: (data: any) => Promise<void>;
  onRestoreStudent?: (studentId: string) => Promise<void>; // 💡 수업취소 복구 전용
  onBatchAddStudents?: (newStudents: any[]) => Promise<boolean>;
  masterTextbooks: TextbookOption[];
  teachers?: any[];
  title?: string;
  showAddButton?: boolean;
  hideTodaySection?: boolean;
  consultationCycle?: number;
  onStartClass?: () => void;
  academyInfo?: any;
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  currentUser?: any;
  showDuplicateWarning?: boolean;
  isLight?: boolean;
}

import { downloadStudentTemplate, detectDuplicatePhoneStudents } from './utils/studentExcelParser';

export default function Overview({ 
  todayStudents = [], excludedStudents = [], filteredAllStudents = [], allTodayIds = [], selectedStudentId, onSelectStudent, 
  onViewProgress,
  selectedDate, onDateChange,
  todayKey,
  selectedFilter = 'All', isBatchMode, setIsBatchMode, onBatchAdd, onRemoveFromToday, onAddNewStudent, onRestoreStudent, onBatchAddStudents, masterTextbooks = [],
  teachers = [],
  title,
  showAddButton = false,
  hideTodaySection = false,
  consultationCycle = 21,
  onStartClass,
  academyInfo,
  searchQuery = '',
  onSearchChange,
  currentUser,
  showDuplicateWarning = false,
  isLight = false
}: OverviewProps) {
  
  const [selectedForBatch, setSelectedForBatch] = useState<string[]>([]);
  const [selectedToRemove, setSelectedToRemove] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 💡 [추가] 로그인 전화번호 뒷자리 중복 학생 탐지 및 경고 목록 추출
  const duplicatePhoneStudents = useMemo(() => {
    return detectDuplicatePhoneStudents(filteredAllStudents);
  }, [filteredAllStudents]);

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
        const startTimeIdx = headers.indexOf('수업시작시간') !== -1 
          ? headers.indexOf('수업시작시간') 
          : (headers.indexOf('시작시간') !== -1 ? headers.indexOf('시작시간') : headers.indexOf('등원시간'));
        const durationIdx = headers.indexOf('수업시간(시수)') !== -1 
          ? headers.indexOf('수업시간(시수)') 
          : (headers.indexOf('수업시간') !== -1 ? headers.indexOf('수업시간') : headers.indexOf('시수'));
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

          // 💡 수업 시작시간 및 수업 시수(시간) 스마트 파싱
          let defaultStart = 1600;
          let durationHours = 3;

          // 1) 시수(소요시간) 파싱
          if (durationIdx !== -1 && row[durationIdx]) {
            const rawDurStr = String(row[durationIdx] || '').trim();
            const durMatch = rawDurStr.match(/\d+/);
            if (durMatch) {
              const parsedDur = parseInt(durMatch[0]);
              if (parsedDur >= 1 && parsedDur <= 12) durationHours = parsedDur;
            }
          }

          // 2) 시작시각 파싱
          if (startTimeIdx !== -1 && row[startTimeIdx]) {
            const rawTimeStr = String(row[startTimeIdx] || '').trim();
            if (rawTimeStr.includes('7시') || rawTimeStr.includes('19')) {
              defaultStart = 1900;
            } else if (rawTimeStr.includes('4시') || rawTimeStr.includes('16')) {
              defaultStart = 1600;
            } else if (rawTimeStr.includes('5시') || rawTimeStr.includes('17')) {
              defaultStart = 1700;
            } else if (rawTimeStr.includes('6시') || rawTimeStr.includes('18')) {
              defaultStart = 1800;
            } else {
              const nums = rawTimeStr.match(/\d+/g);
              if (nums && nums.length > 0) {
                let val = parseInt(nums[0]);
                if (val < 24 && val >= 1) {
                  if (val >= 1 && val <= 10) val += 12; // 7 -> 19시
                  defaultStart = val * 100;
                } else if (val >= 100) {
                  defaultStart = val;
                }
              }
            }
          }

          const defaultEnd = defaultStart + (durationHours * 100);
          
          const daySchedules: Record<string, number[]> = {};
          cleanedDays.forEach(d => {
            daySchedules[d] = [defaultStart, defaultEnd];
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
  const [makeupCourses, setMakeupCourses] = useState<Record<string, string>>({});

  const isArchiveMode = useMemo(() => selectedFilter?.toLowerCase() === 'discharged', [selectedFilter]);

  const studentsToDisplay = useMemo(() => {
    return filteredAllStudents || [];
  }, [filteredAllStudents]);

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
      await onBatchAdd(reasonModal.studentIds, reasons, makeupHours, makeupCourses);
      setSelectedForBatch([]);
    } else {
      await Promise.all(reasonModal.studentIds.map(id => onRemoveFromToday(id, reasons[id] || '수업 취소')));
      setSelectedToRemove([]);
    }
    
    setReasonModal({ ...reasonModal, isOpen: false });
    setReasons({});
    setMakeupHours({});
    setMakeupCourses({});
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
      {/* ⚠️ 로그인 전화번호 중복 탐지 알림 배너 */}
      {!isArchiveMode && showDuplicateWarning && duplicatePhoneStudents.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[4px] p-4 text-amber-200 text-xs space-y-2 shadow-lg animate-fade-in no-print">
          <div className="flex items-center gap-2 font-black text-amber-500 uppercase tracking-wider text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            ⚠️ 로그인 충돌 경보 (전화번호 뒷 4자리 중복 감지)
          </div>
          <p className="text-gray-400 text-[11px] font-bold leading-relaxed">
            학원에 전화번호 끝자리가 일치하여 로그인 페이지 충돌 우려가 있는 학생들이 발견되었습니다.<br/>
            선생님은 아래 학생 카드(학생정보 수정 서랍)를 클릭해 <strong>Login Extra Digit (추가번호)</strong>를 <strong>1</strong>, <strong>2</strong> 등으로 부여해 주시면 즉시 해결됩니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2 pt-1">
            {duplicatePhoneStudents.map(group => (
              <div key={group.last4} className="bg-black/40 border border-amber-500/10 rounded-[2px] p-2.5 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-black text-amber-500/80 uppercase">
                  <span>끝자리: {group.last4}</span>
                  <span className="bg-amber-500/10 px-1 rounded text-[8px]">{group.students.length}명 대기</span>
                </div>
                <div className="space-y-1 mt-1">
                  {group.students.map(s => {
                    const suffix = (s as any).login_suffix || '';
                    return (
                      <div key={s.id} onClick={() => onSelectStudent(s.id)} className="flex items-center justify-between bg-white/[0.02] hover:bg-amber-500/10 p-1.5 rounded-[2px] border border-white/5 cursor-pointer transition-all">
                        <span className="font-bold text-gray-200">{s.name} <span className="text-[10px] text-gray-400 font-bold">({s.school || '학원생'} {s.grade})</span></span>
                        {suffix ? (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1 rounded font-black">추가번호 {suffix}</span>
                        ) : (
                          <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[9px] px-1 rounded font-black animate-pulse">설정 필요</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isArchiveMode && !hideTodaySection && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <h3 className={`text-[12px] font-bold uppercase tracking-wider flex items-center gap-2 ${
                  isLight ? 'text-blue-700' : 'text-blue-500'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
                  {todayKey === getDayOfWeek(getTodayStr()) ? "Today's Schedule" : `${todayKey}요일 Schedule`}
                </h3>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] px-2.5 py-1 rounded border uppercase font-bold tracking-tight shadow-xs ${
                    isLight 
                      ? 'text-[#0f172a] bg-white border-[#e3e2e0]' 
                      : 'text-gray-200 bg-white/5 border-white/10'
                  }`}>
                    <span className={isLight ? "text-amber-700 font-bold" : "text-amber-400 font-black"}>{todayStudents.length}</span> Students
                  </span>
                  {todayGradeStats.map(([grade, count], idx) => {
                    const isES = grade.includes('초');
                    const isMS = grade.includes('중');
                    const isHS = grade.includes('고');
                    const colorClass = isES 
                      ? (isLight ? 'text-emerald-700 font-medium' : 'text-emerald-400') 
                      : isHS 
                        ? (isLight ? 'text-amber-700 font-medium' : 'text-amber-400') 
                        : (isLight ? 'text-blue-700 font-medium' : 'text-blue-400');
                    return (
                      <div key={grade || idx} className={`flex items-center gap-1.5 px-2 py-1 rounded-[2px] shadow-sm ${isLight ? 'bg-white border border-[#e3e2e0]' : 'bg-white/[0.04] border border-white/10'}`}>
                        <span className={`text-[10px] font-medium uppercase ${isLight ? 'text-[#37352f]' : 'text-gray-200'}`}>{grade}</span>
                        <span className={`text-[10px] ${colorClass}`}>{count}</span>
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
                  className={`flex items-center gap-2 rounded px-3 py-1 transition-all group/date relative cursor-pointer border ${
                    isLight 
                      ? 'bg-white border-[#e3e2e0] text-[#0f172a] shadow-xs hover:border-blue-400' 
                      : 'bg-white/5 border-white/10 text-gray-200 hover:text-white'
                  }`}
                >
                  <Calendar size={12} className={isLight ? "text-blue-600" : "group-hover/date:text-blue-500"} />
                  <span className="text-[11px] font-bold uppercase tracking-tight">
                    {selectedDate.replace(/-/g, '.')}
                  </span>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => onDateChange(e.target.value)}
                    className={`absolute inset-0 opacity-0 cursor-pointer z-10 ${
                      isLight ? '[color-scheme:light]' : '[color-scheme:dark]'
                    }`}
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
                  onAddNewStudent={onAddNewStudent}
                  onRestoreStudent={onRestoreStudent}
                  isLight={isLight}
                />
              );
            })}
            {todayStudents.length === 0 && (
              <div className="col-span-full p-8 rounded-[2px] bg-white/[0.02] border border-dashed border-white/5 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">No classes scheduled</div>
            )}
          </div>
        </section>
      )}
 
      {/* 💡 [추가] 오늘 수업 제외(취소)된 학생 목록 */}
      {!hideTodaySection && excludedStudents && excludedStudents.length > 0 && (
        <section className="space-y-2 pt-4 border-t border-white/5">
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
                onAddNewStudent={onAddNewStudent}
                onRestoreStudent={onRestoreStudent}
                isLight={isLight}
              />
            ))}
          </div>
        </section>
      )}

      <section className={`space-y-2 ${(todayStudents.length > 0 || excludedStudents.length > 0) ? `pt-4 border-t ${isLight ? 'border-[#e3e2e0]' : 'border-white/5'}` : ''}`}>
        <div className={`sticky top-[-8px] z-40 backdrop-blur-sm pb-4 pt-2 -mx-2 px-3 border-b ${isLight ? 'bg-[#f4f4f5]/95 border-[#e3e2e0]' : 'bg-[#050505]/95 border-white/5'}`}>
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col gap-0.5">
              <h3 className={`text-[12px] font-bold uppercase tracking-wider flex items-center gap-2 ${isLight ? 'text-[#0f172a]' : 'text-gray-100'}`}>
                <Users size={14} /> 
                {title ? title : (isArchiveMode ? 'Discharged Students Archive' : 'Rest of Students')}
              </h3>
              {!isArchiveMode && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[11px] px-2.5 py-1 rounded border uppercase font-bold tracking-tight shadow-xs ${
                    isLight 
                      ? 'text-[#0f172a] bg-white border-[#e3e2e0]' 
                      : 'text-gray-200 bg-white/5 border-white/10'
                  }`}>
                    <span className={isLight ? "text-amber-700 font-bold" : "text-amber-500 font-black"}>{studentsToDisplay.length}</span> Students
                  </span>
                  {otherGradeStats.map(([grade, count], idx) => {
                    const isES = grade.includes('초');
                    const isMS = grade.includes('중');
                    const isHS = grade.includes('고');
                    const colorClass = isES ? 'text-emerald-600' : isHS ? 'text-amber-600' : 'text-blue-600';
                    return (
                      <div key={grade || idx} className={`flex items-center gap-1.5 px-2 py-1 rounded-[2px] shadow-sm ${isLight ? 'bg-white border border-[#e3e2e0]' : 'bg-white/[0.03] border border-white/10'}`}>
                        <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-[#37352f]' : 'text-gray-200'}`}>{grade}</span>
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase tracking-widest transition-all border ${
                          isLight 
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 border-gray-300 shadow-sm' 
                            : 'bg-white/5 text-gray-400 hover:text-white border-white/10'
                        }`}
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
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase tracking-widest transition-all border ${
                          isLight
                            ? 'bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white border-purple-200 shadow-sm'
                            : 'bg-purple-600/10 text-purple-400 hover:bg-purple-600 hover:text-white border-purple-500/20'
                        }`}
                        title="엑셀 작성본 업로드하여 학생 일괄 등록"
                      >
                        <Upload size={10} /> 엑셀 일괄 등록
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase tracking-widest transition-all border ${
                      isLight
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border-emerald-200 shadow-sm'
                        : 'bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600 hover:text-white border-emerald-500/20'
                    }`}
                  >
                    <UserPlus size={10} /> 신규 학생 등록
                  </button>
                </div>
              )}
              
              {isBatchMode && (
                <button 
                  onClick={() => { setIsBatchMode(false); setSelectedForBatch([]); setSelectedToRemove([]); }}
                  className="px-3 py-1.5 rounded-[2px] text-[9px] font-black uppercase bg-white/5 text-gray-500 hover:text-white transition-all"
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
                        ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/30 border-2 border-blue-400 animate-pulse' 
                        : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.04] active:scale-[0.96] border-2 border-blue-500/40 shadow-lg shadow-blue-900/50'
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
              <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                isLight ? 'text-gray-400 group-focus-within:text-blue-600' : 'text-gray-600 group-focus-within:text-blue-500'
              }`} size={14} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="찾으실 학생 이름을 입력하세요..."
                className={`w-full rounded-[2px] py-2.5 pl-10 pr-10 text-xs outline-none transition-all font-bold ${
                  isLight 
                    ? 'bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 shadow-sm'
                    : 'bg-white/[0.03] border border-white/10 text-white placeholder:text-gray-700 focus:bg-white/[0.06] focus:border-blue-500/50'
                }`}
              />
              {searchQuery && (
                <button 
                  onClick={() => onSearchChange('')}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 transition-colors p-1 ${
                    isLight ? 'text-gray-400 hover:text-gray-700' : 'text-gray-500 hover:text-white'
                  }`}
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
                onClick={() => isBatchMode ? toggleSelection(s.id) : onSelectStudent(s.id)} 
                academyInfo={academyInfo}
                onRemoveFromToday={onRemoveFromToday}
                onAddNewStudent={onAddNewStudent}
                onRestoreStudent={onRestoreStudent}
                isLight={isLight}
              />
            );
          })}
          {studentsToDisplay.length === 0 && (
            <div className="p-10 text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest border border-dashed border-white/5 rounded-sm w-full col-span-full">
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="bg-[#1a1a1a] border border-white/10 p-6 rounded-sm max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reasonModal.type === 'add' ? 'bg-blue-500/20 text-blue-500' : 'bg-red-500/20 text-red-500'}`}>
                    {reasonModal.type === 'add' ? <Users size={20} /> : <MinusCircle size={20} />}
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase">{reasonModal.type === 'add' ? '오늘 수업 변경' : '오늘 수업 제외'}</h4>
                    <p className="text-[10px] text-gray-500 font-bold">{reasonModal.studentIds.length} 명의 학생 선택됨</p>
                  </div>
                </div>

                {reasonModal.type === 'add' && (
                  <div className="bg-blue-600/10 border border-blue-500/20 p-3 rounded-[2px] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase text-blue-400 tracking-widest block">보강 사유 일괄 선택</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const updated: Record<string, string> = {};
                            reasonModal.studentIds.forEach(id => { updated[id] = '시험보강'; });
                            setReasons(updated);
                          }}
                          className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-black transition-all"
                        >
                          📌 시험보강
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated: Record<string, string> = {};
                            reasonModal.studentIds.forEach(id => { updated[id] = '진도보강'; });
                            setReasons(updated);
                          }}
                          className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-black transition-all"
                        >
                          📚 진도보강
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated: Record<string, string> = {};
                            reasonModal.studentIds.forEach(id => { updated[id] = '결석보강'; });
                            setReasons(updated);
                          }}
                          className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500 hover:text-white transition-all"
                        >
                          🏥 결석보강
                        </button>
                      </div>
                    </div>
                    <label className="text-[9px] font-black uppercase text-blue-400 tracking-widest block pt-1">보강 시간 일괄 지정</label>
                    <select 
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) handleBatchHourChange(parseInt(val));
                      }}
                      className="w-full bg-black/60 border border-white/10 rounded-[2px] px-3 py-2 text-[11px] font-black text-amber-500 outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="">교시를 선택하세요 (일괄 적용)</option>
                      {hourOptions.map(h => (
                        <option key={h} value={h} className="bg-[#121212]">
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
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-1 block mb-1">학생별 사유 및 시간 입력</label>
                  {reasonModal.studentIds.map((id) => {
                    const stObj = filteredAllStudents.find(s => s.id === id) || todayStudents.find(s => s.id === id);
                    const rawElective = stObj?.book_courses?.['__elective_courses'];
                    let electiveCourses: any[] = [];
                    if (rawElective) {
                      try {
                        electiveCourses = typeof rawElective === 'string' ? JSON.parse(rawElective) : Array.isArray(rawElective) ? rawElective : [];
                      } catch (e) {}
                    }

                    return (
                      <div key={id} className="space-y-2 bg-white/[0.02] p-3 rounded-[2px] border border-white/5">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[11px] font-black text-gray-300">{getStudentName(id)}</span>
                          {reasonModal.type === 'add' && electiveCourses.length > 0 && (
                            <span className="text-[9px] font-bold text-amber-400">선택과목 수강생</span>
                          )}
                        </div>
                        
                        <div className={reasonModal.type === 'add' ? "grid grid-cols-3 gap-2" : "w-full"}>
                          <div className="space-y-1">
                            {reasonModal.type === 'add' && (
                              <div className="flex items-center justify-between">
                                <label className="text-[8px] font-bold uppercase text-gray-600 tracking-widest px-0.5 block">보강 사유</label>
                                <div className="flex items-center gap-0.5">
                                  <button type="button" onClick={() => updateIndividualReason(id, '시험보강')} className="text-[7.5px] font-bold px-1 py-0.5 bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500 hover:text-black transition-all">시험</button>
                                  <button type="button" onClick={() => updateIndividualReason(id, '진도보강')} className="text-[7.5px] font-bold px-1 py-0.5 bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500 hover:text-black transition-all">진도</button>
                                  <button type="button" onClick={() => updateIndividualReason(id, '결석보강')} className="text-[7.5px] font-bold px-1 py-0.5 bg-purple-500/20 text-purple-300 rounded hover:bg-purple-500 hover:text-white transition-all">결석</button>
                                </div>
                              </div>
                            )}
                            <input 
                              type="text" 
                              value={reasons[id] || ''} 
                              onChange={(e) => updateIndividualReason(id, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && confirmReason()}
                              placeholder="사유 입력"
                              className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-[11px] font-bold text-white outline-none focus:border-blue-500 transition-all"
                            />
                          </div>

                          {reasonModal.type === 'add' && (
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold uppercase text-gray-600 tracking-widest px-0.5 block">보강 과목</label>
                              <select 
                                value={makeupCourses[id] || '정규'}
                                onChange={(e) => setMakeupCourses(prev => ({ ...prev, [id]: e.target.value }))}
                                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-2 py-2 text-[10px] font-bold text-sky-400 outline-none focus:border-blue-500 transition-all cursor-pointer"
                              >
                                <option value="정규">정규 수업</option>
                                {electiveCourses.map((c: any, cIdx: number) => {
                                  const subject = c.subject?.trim() || `특강 ${cIdx + 1}`;
                                  return (
                                    <option key={cIdx} value={subject} className="bg-[#121212]">
                                      {subject}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                          
                          {reasonModal.type === 'add' && (
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold uppercase text-gray-600 tracking-widest px-0.5 block">보강 시간</label>
                              <select 
                                value={makeupHours[id] || 15}
                                onChange={(e) => updateIndividualHour(id, parseInt(e.target.value))}
                                className="w-full bg-black/40 border border-white/10 rounded-[2px] px-3 py-2 text-[11px] font-bold text-amber-500 outline-none focus:border-blue-500 transition-all cursor-pointer"
                              >
                                {hourOptions.map(h => (
                                  <option key={h} value={h} className="bg-[#121212]">
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
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setReasonModal({ ...reasonModal, isOpen: false })} 
                    className="flex-1 py-3 bg-white/5 text-gray-500 rounded-[2px] text-[10px] font-black uppercase hover:bg-white/10 transition-all"
                  >
                    취소
                  </button>
                  <button 
                    onClick={confirmReason}
                    className={`flex-1 py-3 rounded-[2px] text-[10px] font-black uppercase shadow-lg transition-all ${
                      reasonModal.type === 'add' 
                        ? 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500' 
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
  student, isSelected, isChecked, isBatchMode, onClick, onViewProgress, currentDay, masterTextbooks, consultationCycle = 21, academyInfo, onRemoveFromToday, onAddNewStudent, onRestoreStudent, isLight = false
}: { 
  student: Student, isSelected: boolean, isChecked?: boolean, isBatchMode: boolean, onClick: () => void, onViewProgress?: (id: string) => void, currentDay?: string, masterTextbooks: TextbookOption[], consultationCycle?: number, academyInfo?: any, onRemoveFromToday?: (id: string, reason: string, mode?: 'delete' | 'cancel') => Promise<void>, onAddNewStudent?: (data: any) => Promise<void>, onRestoreStudent?: (studentId: string) => Promise<void>, isLight?: boolean
}) {
  const isSelectionMode = isBatchMode && isChecked !== undefined;
  
  // 💡 [시간 이동 / 보강 감지 정밀화] (당일 정규 수업의 수동 시간이동에만 뱃지 생성)
  const movedHourVal = (() => {
    if (student.todaySession?.is_pure_makeup === true) return null;

    if (
      student.todaySession?.moved_to_hour &&
      student.todaySession.moved_to_hour > 0
    ) {
      return student.todaySession.moved_to_hour;
    }

    return null;
  })();
  const isTimeShifted = movedHourVal !== undefined && movedHourVal !== null && movedHourVal > 0;
  const isMakeup = student.todaySession?.is_pure_makeup === true;
  const isAbsent = ['수업취소', '수업제외', '결석'].includes(student.todaySession?.attendance_status || '');
  
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

  // 💡 오늘 정규 수업 및 선택과목(특강) 수강 판별 로직
  const courseBadgeText = useMemo(() => {
    const rawElective = student.book_courses?.['__elective_courses'];
    let electiveSubjects: string[] = [];
    if (rawElective) {
      try {
        const parsed = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
        if (Array.isArray(parsed)) {
          parsed.forEach((c: any) => {
            if (!c) return;
            const subject = c.subject || c.course_name || c.name;
            if (!subject) return;
            const days = c.days;
            const matchesDay = currentDay && days && (
              Array.isArray(days)
                ? days.some((d: any) => typeof d === 'string' && d.trim() === currentDay)
                : (typeof days === 'string' && days.includes(currentDay))
            );
            if (matchesDay && !electiveSubjects.includes(subject)) {
              electiveSubjects.push(subject);
            }
          });
        }
      } catch (e) {}
    }

    if (electiveSubjects.length === 0) return null; // 선택과목 없으면 뱃지 없음

    const hasRegular = student.isScheduledToday || (student.class_days || []).includes(currentDay || '');

    if (hasRegular) {
      return `정규, ${electiveSubjects.join(', ')}`;
    } else {
      return electiveSubjects.join(', ');
    }
  }, [student, currentDay]);

  // 💡 변동 시간 뱃지 텍스트 (원래시간 ➔ 이동시간 형태)
  const timeDisplayInfo = useMemo(() => {
    const dayKey = currentDay || getDayOfWeek(new Date().toISOString().split('T')[0]);
    const regularHours = student.day_schedules?.[dayKey] || [];
    let origHourStr = '';
    if (regularHours.length > 0) {
      const origH = regularHours[0] >= 100 ? Math.floor(regularHours[0] / 100) : regularHours[0];
      origHourStr = `${origH > 12 ? origH - 12 : origH}시`;
    }

    if (!movedHourVal || movedHourVal <= 0) return { isShifted: false, badgeText: '' };
    let mH = movedHourVal >= 100 ? Math.floor(movedHourVal / 100) : movedHourVal;
    const movedHourStr = `${mH > 12 ? mH - 12 : mH}시`;

    if (origHourStr && origHourStr !== movedHourStr) {
      return {
        isShifted: true,
        badgeText: `이동 ${origHourStr}➔${movedHourStr}`
      };
    } else {
      return {
        isShifted: true,
        badgeText: `이동 ${movedHourStr}`
      };
    }
  }, [student, currentDay, movedHourVal]);

  // 💡 선택과목 전체 시간표 목록 (하단 표시용)
  const electiveSchedules = useMemo(() => {
    const rawElective = student.book_courses?.['__elective_courses'];
    if (!rawElective) return [];

    try {
      const parsed = typeof rawElective === 'string' ? JSON.parse(rawElective) : rawElective;
      if (!Array.isArray(parsed)) return [];

      const order: Record<string, number> = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 7 };
      const formatHour = (val: any): string => {
        if (val === undefined || val === null || val === '') return '';
        const num = typeof val === 'string' ? parseInt(String(val).replace(/[^0-9]/g, ''), 10) : Number(val);
        if (isNaN(num) || num <= 0) return '';
        let h = num >= 100 ? Math.floor(num / 100) : num;
        let m = num >= 100 ? num % 100 : 0;
        if (h <= 12) h += 12;
        let displayH = h > 12 ? h - 12 : h;
        if (displayH === 0) displayH = 12;
        return m === 0 ? `${displayH}시` : `${displayH}시 ${m}분`;
      };

      const result: { subject: string; dayTimes: { day: string; timeStr: string; isToday: boolean }[] }[] = [];

      parsed.forEach((c: any) => {
        if (!c || c.is_deleted === true) return;
        const subject = (c.subject || c.course_name || c.name || '특강').trim();
        let days: string[] = [];
        if (Array.isArray(c.days)) {
          days = c.days.filter((d: any) => typeof d === 'string' && d.trim());
        } else if (typeof c.days === 'string') {
          days = c.days.split(',').map((d: string) => d.trim()).filter(Boolean);
        }

        const sortedDays = days.sort((a, b) => (order[a] || 0) - (order[b] || 0));
        const dayTimes: { day: string; timeStr: string; isToday: boolean }[] = [];

        sortedDays.forEach(day => {
          const dayScheduleHour = c.schedules?.[day]?.[0];
          const hoursArrHour = Array.isArray(c.hours) ? c.hours[0] : null;
          const rawTime = dayScheduleHour ?? hoursArrHour ?? c.time;
          const timeStr = formatHour(rawTime);
          dayTimes.push({
            day,
            timeStr,
            isToday: day === currentDay
          });
        });

        if (dayTimes.length > 0) {
          result.push({ subject, dayTimes });
        }
      });

      return result;
    } catch {
      return [];
    }
  }, [student.book_courses, currentDay]);

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
          ? (isLight ? 'hover:border-blue-500/50 hover:bg-blue-50 bg-white border-[#e3e2e0]' : 'hover:border-blue-500/50 hover:bg-blue-500/5 bg-[#0f0f0f] border-white/5')
          : (isLight ? 'hover:border-red-500/50 hover:bg-red-50 bg-white border-[#e3e2e0]' : 'hover:border-red-500/50 hover:bg-red-500/5 bg-[#0f0f0f] border-white/5')
        : isMakeup 
          ? (isLight ? 'bg-emerald-50 border-emerald-300 hover:border-emerald-400' : 'bg-emerald-500/15 border-emerald-500/40 hover:border-emerald-500/60 hover:bg-emerald-500/20')
          : isAbsent
            ? (isLight ? 'bg-red-50 border-red-200 opacity-[0.8] hover:opacity-100' : 'bg-red-500/15 border-red-500/30 opacity-[0.75] hover:opacity-95 hover:border-red-500/20')
            : (isLight ? 'bg-white border-[#e3e2e0] hover:border-[#c3c2c0] hover:bg-[#fafafa] shadow-sm' : 'bg-[#0f0f0f] border-white/5 hover:border-white/10 hover:bg-[#151515]')
    }`}
  >
    <div className="flex flex-col gap-1 overflow-hidden flex-1">
      <div className="flex items-center gap-1.5 overflow-hidden flex-wrap">
        <h4 className={`text-[13px] tracking-tight shrink-0 ${
          isSelected || isChecked 
            ? 'text-white font-bold' 
            : isBatchMode 
              ? (isSelectionMode ? 'group-hover:text-blue-500 font-bold' : 'group-hover:text-red-500 font-bold') 
              : isAbsent
                ? (isLight ? 'text-red-700 font-bold' : 'text-white font-bold')
                : (isLight ? 'text-[#37352f] font-bold' : 'text-gray-100 font-bold')
        }`}>
          {student.name}
        </h4>
        {courseBadgeText && (
          <span className={`text-[9.5px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-normal shrink-0 ${
            isLight 
              ? 'bg-purple-50 text-purple-900 border-purple-300/80 shadow-sm' 
              : 'bg-purple-500/20 text-purple-200 border-purple-500/30'
          }`}>
            {courseBadgeText}
          </span>
        )}
        {consultationStatus.needs && !isBatchMode && (
          <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tight shrink-0 animate-pulse ${
            isLight 
              ? 'bg-rose-50 text-rose-700 border-rose-200/80 shadow-xs' 
              : `${consultationStatus.bg} ${consultationStatus.color} ${consultationStatus.border}`
          }`}>
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
                  className={`p-1 rounded border transition-all ${
                    isLight 
                      ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white shadow-xs' 
                      : 'bg-blue-500/10 text-blue-500 border-transparent hover:bg-blue-500 hover:text-white shadow-sm shadow-blue-900/20'
                  }`}
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
                className={`p-1 rounded border transition-all ${
                  isLight 
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white shadow-xs' 
                    : 'bg-indigo-500/10 text-indigo-400 border-transparent hover:bg-indigo-500 hover:text-white shadow-sm shadow-indigo-900/20'
                }`}
                title="학생 페이지 보기"
              >
                <ExternalLink size={10} strokeWidth={3} />
              </button>
              {/* 💡 수업취소 상태일 때: 수업취소 해제(복구) 버튼 / 정상 상태일 때: 수업제외/삭제 버튼 */}
              {isAbsent ? (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // 💡 수업 복구 전용 함수(onRestoreStudent)에 학생 ID를 직접 전달
                    onRestoreStudent?.(student.id);
                  }}
                  className={`p-1 rounded border transition-all ${
                    isLight 
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white shadow-xs' 
                      : 'bg-emerald-500/20 text-emerald-400 border-transparent hover:bg-emerald-500 hover:text-white shadow-sm shadow-emerald-900/20'
                  }`}
                  title="수업취소 해제 (원래 수업으로 복구)"
                >
                  <RefreshCw size={10} />
                </button>
              ) : (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromToday?.(student.id, '수업 취소', 'delete');
                  }}
                  className={`w-4 h-4 rounded transition-all shadow-xs flex items-center justify-center text-[9px] font-bold leading-none border ${
                    isLight 
                      ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white' 
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/40 hover:text-rose-200'
                  }`}
                  title="기록 리셋 / 보강 제외 (R)"
                >
                  R
                </button>
              )}
            </div>
          )}
          {/* 💡 우측 하단: 출결 뱃지 아래에 이동/보강 변동시간 뱃지를 수직으로 배치 */}
          <div className="flex flex-col items-end gap-0.5 ml-auto shrink-0">
            {isAbsent && !isSelected && !isChecked && (
              <span 
                className={`text-[8.5px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-tight cursor-help ${
                  isLight 
                    ? 'bg-red-50 text-red-700 border-red-200 shadow-xs' 
                    : 'bg-red-500/20 text-red-400 border-red-500/20'
                }`}
                title={student.todaySession?.attendance_reason || '결석 사유 미기입'}
              >
                결석 {student.todaySession?.attendance_reason ? `(${student.todaySession.attendance_reason})` : ''}
              </span>
            )}
            {isMakeup && !isSelected && !isChecked && (
              <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tight ${
                isLight 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs' 
                  : 'bg-emerald-500/20 text-emerald-500 border-emerald-500/20'
              }`}>
                {timeDisplayInfo.badgeText || '보강'}
              </span>
            )}
            {!isMakeup && isTimeShifted && !isSelected && !isChecked && (
              <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tight ${
                isLight 
                  ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-xs' 
                  : 'bg-blue-500/20 text-blue-400 border-blue-500/20'
              }`}>
                {timeDisplayInfo.badgeText || '이동'}
              </span>
            )}
          </div>
          <span className={`text-[11px] font-medium truncate ${isSelected || isChecked ? 'text-blue-100' : (isLight ? 'text-[#37352f]' : 'text-gray-200')}`}>
            <span className={
              (student.grade || '').includes('초') ? (isLight ? 'text-emerald-700 font-medium' : 'text-emerald-400') :
              (student.grade || '').includes('중') ? (isLight ? 'text-blue-700 font-medium' : 'text-blue-400') :
              (student.grade || '').includes('고') ? (isLight ? 'text-amber-700 font-medium' : 'text-amber-400') :
              ''
            }>
              {student.grade}
            </span>
            {student.grade ? ' · ' : ''}{student.course}{student.class ? ` · ${student.class}` : ''}
          </span>

          {/* 💡 주의사항 및 미션 인디케이터 (Hover 시 내용 노출) */}
          <div className="flex items-center gap-1.5 ml-1">
            {student.management_notes && (
              <div className="relative group/tooltip">
                <StickyNote size={12} className={isLight ? "text-amber-600 opacity-90 group-hover/tooltip:opacity-100 transition-opacity" : "text-amber-500 opacity-80 group-hover/tooltip:opacity-100 transition-opacity"} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-amber-100 text-amber-900 text-[10px] font-bold rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-all z-50 border border-amber-200">
                  <div className="flex items-center gap-1 mb-1 border-b border-amber-900/10 pb-1 text-[8px] uppercase tracking-tighter opacity-60"><StickyNote size={8} /> Teacher's Note</div>
                  <div className="whitespace-pre-wrap leading-tight">{student.management_notes}</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-amber-100" />
                </div>
              </div>
            )}
            {student.recent_mission && (
              <div className="relative group/tooltip">
                <Target size={12} className={isLight ? "text-blue-600 opacity-90 group-hover/tooltip:opacity-100 transition-opacity" : "text-blue-500 opacity-80 group-hover/tooltip:opacity-100 transition-opacity"} />
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
                  isSelected || isChecked ? 'bg-white/20 text-white' : (isLight ? 'bg-gray-100 text-gray-800 border border-gray-300' : 'bg-white/10 text-gray-100 border border-white/10')
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
              <div key={day} className={`flex items-center gap-0.5 px-1 py-0.5 rounded-md ${isToday ? (isLight ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-white/10 ring-1 ring-white/10') : ''}`}>
                <span className={`text-[10px] mr-0.5 font-bold ${isToday ? (isLight ? 'text-emerald-700 font-black' : 'text-emerald-400 font-black') : (isLight ? 'text-gray-600' : 'text-gray-300')}`}>{day}</span>
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
                      colorClass = isToday ? (isLight ? 'text-emerald-700 font-black' : 'text-emerald-400 font-black') : (isLight ? 'text-emerald-800' : 'text-emerald-300/85');
                    } else if (isLateTime) {
                      colorClass = isToday ? (isLight ? 'text-amber-700 font-black' : 'text-amber-400 font-black') : (isLight ? 'text-amber-800' : 'text-amber-300/85');
                    } else {
                      colorClass = isToday ? (isLight ? 'text-blue-700 font-black' : 'text-blue-400 font-black') : (isLight ? 'text-blue-800' : 'text-blue-300/85');
                    }

                    return (
                      <span className={`text-[10px] font-black leading-none ${colorClass}`}>
                        {timeStr}
                      </span>
                    );
                  })()
                ) : (
                  <span className={`text-[10px] font-bold ${isLight ? 'text-gray-400' : 'text-gray-700'}`}>-</span>
                )}
              </div>
            );
          })}
        </div>

        {electiveSchedules.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1 border-t border-dashed border-white/5 pt-0.5">
            {electiveSchedules.map((item, idx) => (
              <div key={`${item.subject}-${idx}`} className="flex items-center gap-1 text-[9.5px]">
                <span className={`font-bold px-1 py-0.2 rounded text-[8.5px] ${isLight ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-500/15 text-indigo-300'}`}>
                  {item.subject}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.dayTimes.map((dt, dIdx) => (
                    <div key={dIdx} className={`flex items-center gap-0.5 px-1 py-0.2 rounded-md ${dt.isToday ? (isLight ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-white/10 ring-1 ring-indigo-500/30') : ''}`}>
                      <span className={`text-[10px] font-bold ${dt.isToday ? (isLight ? 'text-indigo-800 font-black' : 'text-indigo-300 font-black') : (isLight ? 'text-gray-600' : 'text-gray-300')}`}>
                        {dt.day}
                      </span>
                      {dt.timeStr && (
                        <span className={`text-[10px] font-black leading-none ${dt.isToday ? (isLight ? 'text-indigo-900 font-black' : 'text-indigo-200 font-black') : (isLight ? 'text-indigo-600' : 'text-indigo-400/90')}`}>
                          {dt.timeStr}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {isBatchMode ? (
          isSelectionMode ? (
            isChecked ? (
              <div className="bg-white text-blue-600 p-0.5 rounded-full shadow-lg">
                <Check size={10} strokeWidth={4} />
              </div>
            ) : (
              <div className="w-4 h-4 rounded-full border border-white/20 group-hover:border-blue-500/50 transition-colors" />
            )
          ) : (
            <MinusCircle size={14} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )
        ) : (
          <>
            <div className="flex gap-0.5">
              {(student.history || []).map((status, i) => (
                <div key={i} className={`w-1 h-1 rounded-full ${(status as any) === 'perfect' ? 'bg-emerald-500' : (status as any) === 'good' ? 'bg-emerald-400' : (status as any) === 'warning' || (status as any) === 'neutral' ? 'bg-amber-500' : (status as any) === 'poor' || (status as any) === 'late' ? 'bg-orange-500' : (status as any) === 'bad' ? 'bg-red-500' : 'bg-white/10'}`} />
              ))}
            </div>
            <ChevronRight size={12} className={isSelected ? 'text-white' : 'text-gray-600'} />
          </>
        )}
      </div>
    </motion.div>
  );
}
