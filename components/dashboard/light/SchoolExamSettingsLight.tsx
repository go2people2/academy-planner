'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, School, AlertTriangle, Save, Loader2, Trash2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SchoolExamSettingsProps {
  academyInfo: any;
  students: any[];
  onUpdateAcademyInfo?: (updates: any) => Promise<void>;
}

export default function SchoolExamSettingsLight({ academyInfo, students, onUpdateAcademyInfo }: SchoolExamSettingsProps) {
  const [examSchedules, setExamSchedules] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editExamData, setEditExamData] = useState<any>({});

  const EXAM_TYPES = [
    { id: '1-MID', label: '1학기 중간' },
    { id: '1-FINAL', label: '1학기 기말' },
    { id: '2-MID', label: '2학기 중간' },
    { id: '2-FINAL', label: '2학기 기말' }
  ];

  const HIGH_SUBJECTS = ['공수1', '공수2', '대수', '확통', '기하', '미적분', '미적분2'];

  const currentPeriod = useMemo(() => {
    const settings = academyInfo?.operation_settings || {};
    if (settings.current_exam_period) return settings.current_exam_period;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let type = '1-MID';
    if (month >= 5 && month <= 7) type = '1-FINAL';
    else if (month >= 8 && month <= 10) type = '2-MID';
    else if (month >= 11 || month <= 2) type = '2-FINAL';
    return `${year}-${type}`;
  }, [academyInfo]);

  const [selectedYear, setSelectedYear] = useState(currentPeriod.split('-')[0]);
  const [selectedType, setSelectedType] = useState(`${currentPeriod.split('-')[1]}-${currentPeriod.split('-')[2]}`);

  const [newExam, setNewExam] = useState({
    school_name: '',
    grade: '',
    subject: '',
    target_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });

  const fetchExams = async () => {
    if (!academyInfo?.id) return;
    try {
      const { data, error } = await supabase
        .from('ams_exam_schedules')
        .select('*')
        .eq('academy_id', academyInfo.id)
        .order('target_date', { ascending: true });
      if (error) throw error;
      setExamSchedules(data || []);
    } catch (e) { console.error('Fetch exams error:', e); }
  };

  useEffect(() => { fetchExams(); }, [academyInfo?.id]);

  const isHighSchool = (name: string) => name.includes('고') || name.endsWith('고') || name.includes('고등학교');

  const groupedExams = useMemo(() => {
    const periodKey = `${selectedYear}-${selectedType}`;
    const periodMap: any = {
      '1-MID': ['1학기 중간', '1학기 중간고사'],
      '1-FINAL': ['1학기 기말', '1학기 기말고사'],
      '2-MID': ['2학기 중간', '2학기 중간고사'],
      '2-FINAL': ['2학기 기말', '2학기 기말고사']
    };
    const legacyNames = periodMap[selectedType] || [];
    const filtered = examSchedules.filter(ex => {
      if (ex.exam_name.startsWith(periodKey)) return true;
      const exYear = new Date(ex.target_date).getFullYear();
      if (String(exYear) === selectedYear && legacyNames.includes(ex.exam_name)) return true;
      return false;
    });
    return {
      middle: filtered.filter(ex => !isHighSchool(ex.school_name)),
      high: filtered.filter(ex => isHighSchool(ex.school_name))
    };
  }, [examSchedules, selectedYear, selectedType]);

  const pendingSchools = useMemo(() => {
    if (!students || !examSchedules) return [];
    const allExams = [...groupedExams.middle, ...groupedExams.high];
    const allSchools = Array.from(new Set(students.map(s => s.school).filter(Boolean)));
    const registeredSchools = new Set(allExams.map(ex => ex.school_name));
    const missing = allSchools.filter(school => !registeredSchools.has(school));
    return missing.sort((a, b) => {
      const isAMid = !isHighSchool(a);
      const isBMid = !isHighSchool(b);
      if (isAMid && !isBMid) return -1;
      if (!isAMid && isBMid) return 1;
      return a.localeCompare(b);
    });
  }, [students, groupedExams]);

  const normalizeGradeList = (value: string) => {
    const rawItems = (value || '').split(',');
    const grades = rawItems
      .map((item) => item.trim())
      .filter(Boolean);

    const isValid = grades.length > 0 && grades.every((item) => /^[1-3]$/.test(item));

    if (!isValid) {
      return { value: null, error: '학년은 1, 2, 3 중 하나 이상을 쉼표로 구분해 입력하세요. 예: 1,2 또는 1,2,3' };
    }

    return {
      value: [...new Set(grades)]
        .sort((a, b) => Number(a) - Number(b))
        .join(','),
      error: null,
    };
  };

  const formatGradeDisplay = (gradeVal?: string | null) => {
    if (!gradeVal) return '';
    const parts = gradeVal.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    // 만약 기존 레거시(중3, 고2 등)라면 그대로 노출
    if (parts.every(p => /^[1-3]$/.test(p))) {
      return `적용 학년: ${parts.join('·')}학년`;
    }
    return `적용 학년: ${gradeVal}`;
  };

  const handleSetCurrentPeriod = async () => {
    if (!onUpdateAcademyInfo) return;
    const periodKey = `${selectedYear}-${selectedType}`;
    const nextSettings = { ...(academyInfo?.operation_settings || {}), current_exam_period: periodKey };
    await onUpdateAcademyInfo({ operation_settings: nextSettings });
    alert(`현재 시험 기간이 설정되었습니다.`);
  };

  const handleAddExam = async () => {
    if (!newExam.school_name || !newExam.target_date || !academyInfo?.id) {
      alert('학교와 날짜를 확인해 주세요.');
      return;
    }

    const { value: normalizedGrades, error: gradeError } = normalizeGradeList(newExam.grade);
    if (gradeError || !normalizedGrades) {
      alert(gradeError || '적용 학년을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const periodKey = `${selectedYear}-${selectedType}`;
      const finalExamName = newExam.subject ? `${periodKey}:${newExam.subject}` : periodKey;
      const targetDate = newExam.target_date;
      const endDate = newExam.end_date || targetDate;

      // 💡 [중복 방지] 같은 academy 안에서 current_exam_period + school_name + normalized grade list + target_date + end_date 중복 체크
      const isDuplicate = examSchedules.some(ex => {
        const isSamePeriod = ex.exam_name && ex.exam_name.startsWith(periodKey);
        const isSameSchool = ex.school_name?.trim() === newExam.school_name.trim();
        const isSameGrade = normalizeGradeList(ex.grade || '').value === normalizedGrades;
        const isSameStart = ex.target_date === targetDate;
        const isSameEnd = (ex.end_date || ex.target_date) === endDate;
        const isSameSubject = (ex.exam_name.split(':')[1] || '') === (newExam.subject || '');
        return isSamePeriod && isSameSchool && isSameGrade && isSameStart && isSameEnd && isSameSubject;
      });

      if (isDuplicate) {
        alert('이미 동일한 학교/학년/기간의 시험 일정이 등록되어 있습니다.');
        setIsSaving(false);
        return;
      }

      const payload = {
        academy_id: academyInfo.id,
        school_name: newExam.school_name.trim(),
        grade: normalizedGrades,
        exam_name: finalExamName,
        target_date: targetDate,
        end_date: endDate
      };

      const { error } = await supabase.from('ams_exam_schedules').insert([payload]);
      if (error) throw error;
      setNewExam({ school_name: '', grade: '', subject: '', target_date: new Date().toISOString().split('T')[0], end_date: new Date().toISOString().split('T')[0] });
      await fetchExams();
    } catch (e: any) { alert(`오류: ${e.message}`); } finally { setIsSaving(false); }
  };

  const handleDeleteExam = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    const { error } = await supabase.from('ams_exam_schedules').delete().eq('id', id);
    if (!error) fetchExams();
  };

  const handleUpdateExam = async (id: string) => {
    if (!editExamData.school_name || !editExamData.target_date) {
      alert('학교와 시작 날짜는 필수입니다.');
      return;
    }

    const { value: normalizedGrades, error: gradeError } = normalizeGradeList(editExamData.grade);
    if (gradeError || !normalizedGrades) {
      alert(gradeError || '적용 학년을 입력해 주세요.');
      return;
    }

    const finalExamName = editExamData.subject ? `${selectedYear}-${selectedType}:${editExamData.subject}` : `${selectedYear}-${selectedType}`;
    const payload = {
      school_name: editExamData.school_name.trim(),
      grade: normalizedGrades,
      exam_name: finalExamName,
      target_date: editExamData.target_date,
      end_date: editExamData.end_date || editExamData.target_date
    };
    const { error } = await supabase.from('ams_exam_schedules').update(payload).eq('id', id);
    if (error) {
      alert(`오류: ${error.message}`);
    } else {
      setEditingExamId(null);
      fetchExams();
    }
  };

  const startEditing = (exam: any, subject: string) => {
    setEditingExamId(exam.id);
    setEditExamData({
      school_name: exam.school_name,
      grade: exam.grade || '',
      subject: subject || '',
      target_date: exam.target_date,
      end_date: exam.end_date || exam.target_date
    });
  };

  const currentActiveLabel = useMemo(() => {
    const parts = currentPeriod.split('-');
    if (parts.length >= 3) {
      const y = parts[0];
      const typeKey = `${parts[1]}-${parts[2]}`;
      const found = EXAM_TYPES.find(t => t.id === typeKey);
      return `${y}년 ${found ? found.label : typeKey}`;
    }
    return currentPeriod;
  }, [currentPeriod, EXAM_TYPES]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white border border-[#e3e2e0] rounded-lg overflow-hidden shadow-sm p-4 space-y-4">
        {/* 1행: 시험 기간 선택 */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 border border-[#edece9] rounded px-2.5 py-1">
              <Calendar size={15} className="text-rose-500 opacity-70" />
              <input
                type="number"
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                className="w-16 bg-transparent text-[13px] font-black text-gray-800 outline-none text-center"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-nowrap">
              {EXAM_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`px-3 py-1.5 text-[11px] font-black rounded border whitespace-nowrap transition-all ${
                    selectedType === type.id
                      ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm'
                      : 'bg-white border-[#edece9] text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[11px] font-bold text-gray-500">
              현재 활성: <span className="text-rose-600 font-black">{currentActiveLabel}</span>
            </span>
            <button
              onClick={handleSetCurrentPeriod}
              className={`px-4 py-1.5 rounded text-[11px] font-black uppercase tracking-wider transition-all shrink-0 ${
                currentPeriod === `${selectedYear}-${selectedType}`
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm'
                  : 'bg-rose-600 text-white hover:bg-rose-500 shadow-sm active:scale-95'
              }`}
            >
              {currentPeriod === `${selectedYear}-${selectedType}` ? 'Active' : 'Set Active'}
            </button>
          </div>
        </div>

        {/* 2행: 학교별 시험 일정 등록 */}
        <div className="border-t border-[#edece9] pt-3.5 space-y-2.5">
          <p className="text-[11px] font-black text-gray-600 tracking-wider">학교별 시험 일정 등록</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              placeholder="학교명 *"
              value={newExam.school_name}
              onChange={e => {
                const val = e.target.value;
                setNewExam((prev: any) => ({ ...prev, school_name: val }));
              }}
              className="flex-1 min-w-[150px] bg-white border border-[#edece9] rounded px-3 py-1.5 text-[12px] font-bold text-gray-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
            />
            <input
              type="text"
              placeholder="적용 학년 * (예: 1,2 또는 1,2,3)"
              title="해당 학교에서 시험 일정이 적용되는 학년을 입력하세요. 예: 1,2 / 3"
              value={newExam.grade}
              onChange={e => {
                const val = e.target.value;
                setNewExam((prev: any) => ({ ...prev, grade: val }));
              }}
              className="flex-1 min-w-[180px] bg-white border border-[#edece9] rounded px-3 py-1.5 text-[12px] font-bold text-gray-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
            />
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={newExam.target_date}
                onChange={e => {
                  const val = e.target.value;
                  setNewExam((prev: any) => ({ ...prev, target_date: val }));
                }}
                className="w-32 bg-white border border-[#edece9] rounded px-2.5 py-1.5 text-[12px] text-gray-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
              />
              <span className="text-gray-400 text-[11px]">~</span>
              <input
                type="date"
                value={newExam.end_date}
                onChange={e => {
                  const val = e.target.value;
                  setNewExam((prev: any) => ({ ...prev, end_date: val }));
                }}
                className="w-32 bg-white border border-[#edece9] rounded px-2.5 py-1.5 text-[12px] text-gray-800 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30"
              />
            </div>
            <button
              onClick={handleAddExam}
              disabled={isSaving}
              className="px-5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black rounded uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              {isSaving ? <Loader2 size={12} className="animate-spin" /> : <><Save size={12} /> Add</>}
            </button>
          </div>

          {/* 고등 과목 선택 (필요시 하단에 작게 노출) */}
          {isHighSchool(newExam.school_name) && (
            <div className="pt-2 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold text-gray-500 mr-1">고등 과목:</span>
              {HIGH_SUBJECTS.map(sub => (
                <button
                  key={sub}
                  onClick={() => setNewExam((prev: any) => ({ ...prev, subject: sub }))}
                  className={`px-2 py-0.5 text-[10px] font-black rounded border transition-all ${
                    newExam.subject === sub
                      ? 'bg-rose-100 border-rose-300 text-rose-800'
                      : 'bg-white border-[#edece9] text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {sub}
                </button>
              ))}
              <input
                type="text"
                placeholder="기타"
                value={HIGH_SUBJECTS.includes(newExam.subject) ? '' : newExam.subject}
                onChange={e => {
                  const val = e.target.value;
                  setNewExam((prev: any) => ({ ...prev, subject: val }));
                }}
                className="ml-2 w-16 bg-transparent border-b border-gray-300 px-1 py-0.5 text-[10px] font-bold text-gray-800 outline-none focus:border-rose-500"
              />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {pendingSchools.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-wrap gap-2.5 items-center shadow-sm">
            <div className="flex items-center gap-2 mr-2 border-r border-amber-200 pr-4">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-[11px] font-black text-amber-600 uppercase tracking-widest">미등록</span>
            </div>
            {pendingSchools.map(school => (
              <button
                key={school}
                onClick={() => setNewExam({ ...newExam, school_name: school })}
                className="px-3 py-1.5 bg-white border border-amber-200 rounded-md text-[13px] font-black text-amber-900 hover:bg-amber-50 hover:border-amber-400 transition-all flex items-center gap-2 group shadow-sm"
              >
                <School size={12} className="text-amber-600 opacity-60 group-hover:opacity-100" />
                {school}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-6">
          <ExamListLight
            title="MIDDLE"
            list={groupedExams.middle}
            editingExamId={editingExamId}
            editExamData={editExamData}
            setEditExamData={setEditExamData}
            setEditingExamId={setEditingExamId}
            handleUpdateExam={handleUpdateExam}
            handleDeleteExam={handleDeleteExam}
            startEditing={startEditing}
            formatGradeDisplay={formatGradeDisplay}
          />
          <ExamListLight
            title="HIGH"
            list={groupedExams.high}
            editingExamId={editingExamId}
            editExamData={editExamData}
            setEditExamData={setEditExamData}
            setEditingExamId={setEditingExamId}
            handleUpdateExam={handleUpdateExam}
            handleDeleteExam={handleDeleteExam}
            startEditing={startEditing}
            formatGradeDisplay={formatGradeDisplay}
          />
        </div>
      </div>
    </motion.div>
  );
}

interface ExamListLightProps {
  title: string;
  list: any[];
  editingExamId: string | null;
  editExamData: any;
  setEditExamData: React.Dispatch<React.SetStateAction<any>>;
  setEditingExamId: React.Dispatch<React.SetStateAction<string | null>>;
  handleUpdateExam: (id: string) => Promise<void>;
  handleDeleteExam: (id: string) => Promise<void>;
  startEditing: (exam: any, subject: string) => void;
  formatGradeDisplay: (gradeVal?: string | null) => string;
}

function ExamListLight({
  title,
  list,
  editingExamId,
  editExamData,
  setEditExamData,
  setEditingExamId,
  handleUpdateExam,
  handleDeleteExam,
  startEditing,
  formatGradeDisplay
}: ExamListLightProps) {
  return (
    <div className="flex-1 space-y-2">
      <div className="flex items-center gap-2 px-1">
        <div className={`w-1.5 h-3.5 rounded-full ${title === 'MIDDLE' ? 'bg-blue-600' : 'bg-rose-600'}`} />
        <span className="text-[11px] font-black text-gray-500 tracking-widest">{title} SCHOOLS</span>
        <span className="text-[10px] text-gray-500 font-bold ml-auto">{list.length}</span>
      </div>
      <div className="bg-white border border-[#e3e2e0] rounded-lg overflow-hidden divide-y divide-[#edece9] shadow-sm">
        {list.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-gray-400 font-bold uppercase italic bg-gray-50/30">Empty</div>
        ) : (
          list.map(exam => {
            const subject = exam.exam_name.split(':')[1] || '';
            const diff = Math.ceil((new Date(exam.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

            if (editingExamId === exam.id) {
              return (
                <div key={exam.id} className="flex flex-wrap items-center gap-2 px-4 py-3 bg-blue-50/30 transition-all">
                  <input
                    type="text"
                    value={editExamData.school_name || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setEditExamData((prev: any) => ({ ...prev, school_name: val }));
                    }}
                    className="w-24 bg-white border border-[#edece9] rounded px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:border-blue-500"
                    placeholder="학교명"
                  />
                  <input
                    type="text"
                    value={editExamData.grade || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setEditExamData((prev: any) => ({ ...prev, grade: val }));
                    }}
                    className="w-28 bg-white border border-[#edece9] rounded text-center px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:border-blue-500"
                    placeholder="예: 1,2 / 3"
                    title="적용 학년 (1, 2, 3 쉼표 구분)"
                  />
                  <input
                    type="text"
                    value={editExamData.subject || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setEditExamData((prev: any) => ({ ...prev, subject: val }));
                    }}
                    className="w-16 bg-white border border-[#edece9] rounded px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:border-blue-500"
                    placeholder="과목"
                  />
                  <input
                    type="date"
                    value={editExamData.target_date || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setEditExamData((prev: any) => ({ ...prev, target_date: val }));
                    }}
                    className="w-28 bg-white border border-[#edece9] rounded px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-gray-400 text-[10px]">~</span>
                  <input
                    type="date"
                    value={editExamData.end_date || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setEditExamData((prev: any) => ({ ...prev, end_date: val }));
                    }}
                    className="w-28 bg-white border border-[#edece9] rounded px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-1 ml-auto">
                    <button onClick={() => handleUpdateExam(exam.id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black rounded shadow-sm">저장</button>
                    <button onClick={() => setEditingExamId(null)} className="px-3 py-1 bg-gray-500 hover:bg-gray-400 text-white text-[10px] font-black rounded shadow-sm">취소</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={exam.id} className="flex items-center justify-between px-4 py-2.5 group hover:bg-gray-50/50 transition-all text-[#37352f]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[14px] font-black text-[#37352f] truncate">{exam.school_name}</span>
                  {exam.grade && <span className="px-2 py-0.5 rounded bg-gray-150 text-[11px] font-bold text-rose-700 whitespace-nowrap">{formatGradeDisplay(exam.grade)}</span>}
                  {subject && <span className="px-1.5 py-0.5 rounded border border-gray-200 text-[10px] font-bold text-gray-550 bg-gray-50 whitespace-nowrap truncate">{subject}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[12px] font-black text-gray-800 whitespace-nowrap">
                      {new Date(exam.target_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                      {exam.end_date && exam.end_date !== exam.target_date && ` ~ ${new Date(exam.end_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}`}
                    </p>
                    <p className={`text-[10px] font-bold ${diff < 0 ? 'text-gray-450' : diff === 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                      {diff < 0 ? '종료됨' : diff === 0 ? 'D-Day' : `D-${diff}`}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => startEditing(exam, subject)} className="p-1 hover:text-blue-600 text-gray-400 transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button onClick={() => handleDeleteExam(exam.id)} className="p-1 hover:text-red-600 text-gray-400 transition-all"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
