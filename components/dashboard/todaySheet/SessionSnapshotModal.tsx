'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, BookOpen, Layers, Save, AlertCircle } from 'lucide-react';
import { SessionSnapshot, SessionLog, Student } from '@/types/dashboard';
import { useModalEsc } from '@/hooks/useModalEsc';

interface SessionSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  session: SessionLog;
  selectedDate: string;
  isLight?: boolean;
  onSaveSnapshot: (targetLogId: string, updatedFields: {
    course_name: string;
    moved_to_hour: number | null;
    is_pure_makeup: boolean;
    session_snapshot: SessionSnapshot;
  }) => Promise<boolean>;
}

const ALL_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const ALL_HOURS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export function SessionSnapshotModal({
  isOpen,
  onClose,
  student,
  session,
  selectedDate,
  isLight = false,
  onSaveSnapshot
}: SessionSnapshotModalProps) {
  useModalEsc({ isOpen, onClose });

  const currentSnapshot = session.session_snapshot;
  const isMakeupRow = (student as any).isMakeupRow === true || session.is_pure_makeup === true;
  const isSpecialClass = (student as any).isSpecialClass === true || ((session.course_name && session.course_name !== '정규') && !isMakeupRow);

  // 💡 초기값 계산 (기존 snapshot 우선 -> 세션/학생 데이터 fallback)
  const initialSessionType: 'regular' | 'elective' | 'makeup' =
    currentSnapshot?.sessionType ||
    (isMakeupRow ? 'makeup' : (isSpecialClass ? 'elective' : 'regular'));

  const initialCourseName =
    currentSnapshot?.courseName ||
    session.course_name ||
    student.courseName ||
    '정규';

  const initialDays: string[] =
    currentSnapshot?.scheduledDays !== undefined
      ? currentSnapshot.scheduledDays
      : (initialSessionType === 'makeup' ? [] : (student.class_days || []));

  const initialHours: number[] =
    currentSnapshot?.scheduledHours !== undefined
      ? currentSnapshot.scheduledHours
      : (initialSessionType === 'makeup' ? [] : (
          Object.values(student.day_schedules || {})
            .flat()
            .map((h: any) => {
              const num = parseInt(String(h), 10);
              if (isNaN(num)) return 16;
              return num >= 100 ? Math.floor(num / 100) : num;
            })
        ));

  const initialMovedHour =
    session.moved_to_hour !== undefined && session.moved_to_hour !== null
      ? session.moved_to_hour
      : null;

  const [sessionType, setSessionType] = useState<'regular' | 'elective' | 'makeup'>(initialSessionType);
  const [courseName, setCourseName] = useState<string>(initialCourseName);
  const [scheduledDays, setScheduledDays] = useState<string[]>(initialDays);
  const [scheduledHours, setScheduledHours] = useState<number[]>(initialHours);
  const [movedToHour, setMovedToHour] = useState<number | null>(initialMovedHour);
  const [isPureMakeup, setIsPureMakeup] = useState<boolean>(
    currentSnapshot?.isPureMakeup !== undefined
      ? currentSnapshot.isPureMakeup
      : (initialSessionType === 'makeup')
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleTypeChange = (type: 'regular' | 'elective' | 'makeup') => {
    setSessionType(type);
    if (type === 'makeup') {
      setIsPureMakeup(true);
      setScheduledDays([]);
      setScheduledHours([]);
    } else if (type === 'regular') {
      setIsPureMakeup(false);
      setCourseName('정규');
      if (scheduledDays.length === 0) setScheduledDays(student.class_days || []);
    } else {
      setIsPureMakeup(false);
      if (courseName === '정규') setCourseName('특강');
    }
  };

  const toggleDay = (day: string) => {
    setScheduledDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleHour = (hour: number) => {
    setScheduledHours(prev =>
      prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour].sort((a, b) => a - b)
    );
  };

  const handleSave = async () => {
    const targetId = session.id;
    if (!targetId || targetId === 'temp' || String(targetId).startsWith('temp:')) {
      alert('저장된 DB 일지 로그가 없어 스냅샷을 수정할 수 없습니다.');
      return;
    }

    if (!courseName.trim()) {
      alert('과목명을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 💡 [불변 보존 및 신규 수동 생성 규칙]
      // 1. 기존 snapshot이 있는 경우: 기존 source와 capturedAt 100% 보존
      // 2. snapshot이 null인 경우(레거시/신규 수동 보정): source = 'manual_edit', capturedAt = 현재 시각
      const finalSource: 'today_sheet' | 'manual_edit' = currentSnapshot?.source || 'manual_edit';
      const finalCapturedAt: string = currentSnapshot?.capturedAt || new Date().toISOString();

      // 💡 [courseId 정합성 규칙]
      // - elective 유지 시에만 기존 courseId 보존 (동일 과목명일 때)
      // - regular, makeup 전환 또는 신규 수동 입력 시에는 courseId: null
      const finalCourseId = (sessionType === 'elective' && currentSnapshot?.sessionType === 'elective')
        ? (currentSnapshot.courseId || null)
        : null;

      const finalSnapshot: SessionSnapshot = {
        version: 1,
        sessionType: sessionType,
        courseName: courseName.trim(),
        courseId: finalCourseId,
        scheduledDays: sessionType === 'makeup' ? [] : scheduledDays,
        scheduledHours: sessionType === 'makeup' ? [] : scheduledHours,
        isPureMakeup: sessionType === 'makeup' ? true : isPureMakeup,
        source: finalSource,
        capturedAt: finalCapturedAt
      };

      const success = await onSaveSnapshot(targetId, {
        course_name: courseName.trim(),
        moved_to_hour: movedToHour,
        is_pure_makeup: finalSnapshot.isPureMakeup,
        session_snapshot: finalSnapshot
      });

      if (success) {
        onClose();
      } else {
        alert('스냅샷 저장에 실패했습니다.');
      }
    } catch (e: any) {
      console.error('Failed to save session snapshot:', e);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`w-full max-w-lg rounded-xl shadow-2xl border overflow-hidden ${
          isLight ? 'bg-white border-gray-200 text-gray-900' : 'bg-[#18181b] border-white/10 text-white'
        }`}
      >
        {/* 헤더 */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isLight ? 'border-gray-200 bg-gray-50' : 'border-white/10 bg-white/5'
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 font-bold">
              <Calendar size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                당시 수업 정보(스냅샷) 수정
              </h3>
              <p className="text-[11px] text-gray-400 font-normal">
                {student.name} · {selectedDate} ({session.course_name || '정규'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-md transition-colors ${
              isLight ? 'text-gray-400 hover:text-gray-900 hover:bg-gray-200' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* 폼 본문 */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar-v text-xs">
          {/* 1. 수업 구분 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Layers size={13} /> 1. 수업 구분 (Session Type)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'regular', label: '정규 수업', desc: '정규 시간표' },
                { type: 'elective', label: '선택/특강', desc: '기하/확통/특강' },
                { type: 'makeup', label: '순수 보강', desc: '독립 보강 세션' }
              ].map(t => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleTypeChange(t.type as any)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    sessionType === t.type
                      ? (isLight ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm ring-1 ring-blue-500' : 'bg-blue-500/20 border-blue-500 text-blue-200 shadow-sm ring-1 ring-blue-500')
                      : (isLight ? 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700' : 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300')
                  }`}
                >
                  <div className="font-bold text-[12px]">{t.label}</div>
                  <div className="text-[10px] text-gray-400">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. 과목명 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <BookOpen size={13} /> 2. 과목명 (Course Name)
            </label>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="예: 정규, 기하, 미적분, 방학특강"
              className={`w-full px-3 py-2 rounded-lg border font-medium outline-none transition-all ${
                isLight ? 'bg-white border-gray-300 text-gray-900 focus:border-blue-500' : 'bg-black/30 border-white/15 text-white focus:border-blue-500'
              }`}
            />
          </div>

          {/* 3. 당시 예정 요일 (보강은 숨김) */}
          {sessionType !== 'makeup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={13} /> 3. 당시 예정 요일 (Scheduled Days)
              </label>
              <div className="flex gap-1.5">
                {ALL_DAYS.map(d => {
                  const active = scheduledDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`flex-1 py-1.5 rounded-md text-[11px] font-bold border transition-all ${
                        active
                          ? (isLight ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-emerald-500 border-emerald-500 text-white shadow-sm')
                          : (isLight ? 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10')
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. 당시 예정 시간 (보강은 숨김) */}
          {sessionType !== 'makeup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <Clock size={13} /> 4. 당시 예정 시작 시각 (Scheduled Hours)
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {ALL_HOURS.map(h => {
                  const active = scheduledHours.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => toggleHour(h)}
                      className={`py-1.5 rounded-md text-[11px] font-bold border transition-all ${
                        active
                          ? (isLight ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-blue-500 border-blue-500 text-white shadow-sm')
                          : (isLight ? 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10')
                      }`}
                    >
                      {h > 12 ? `오후 ${h - 12}시` : `오전 ${h}시`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. 실제 진행/이동 시간 (moved_to_hour) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Clock size={13} /> 5. 실제 진행 시각 (Moved To Hour)
            </label>
            <select
              value={movedToHour ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setMovedToHour(val === '' ? null : parseInt(val, 10));
              }}
              className={`w-full px-3 py-2 rounded-lg border font-medium outline-none transition-all ${
                isLight ? 'bg-white border-gray-300 text-gray-900 focus:border-blue-500' : 'bg-black/30 border-white/15 text-white focus:border-blue-500'
              }`}
            >
              <option value="">예정 시간 그대로 (시간 이동 없음)</option>
              {ALL_HOURS.map(h => (
                <option key={h} value={h}>
                  {h > 12 ? `오후 ${h - 12}시 (${h}시)` : `오전 ${h}시 (${h}시)`}
                </option>
              ))}
            </select>
          </div>

          {/* 알림 안내 */}
          <div className={`p-3 rounded-lg border text-[11px] flex items-start gap-2 ${
            isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
          }`}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div>
              스냅샷을 수정하면 과거 TodaySheet 열람 시 현재 시간표와 무관하게 <strong>여기서 설정한 과목·요일·시간</strong>으로 불변 보존되어 표시됩니다.
            </div>
          </div>
        </div>

        {/* 푸터 버튼 */}
        <div className={`px-5 py-3.5 border-t flex items-center justify-end gap-2 ${
          isLight ? 'border-gray-200 bg-gray-50' : 'border-white/10 bg-white/5'
        }`}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-colors ${
              isLight ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? '저장 중...' : '스냅샷 저장'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
