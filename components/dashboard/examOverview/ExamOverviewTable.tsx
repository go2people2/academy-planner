'use client';

import React from 'react';
import { ExternalLink, Calendar, AlertTriangle } from 'lucide-react';
import { EnrichedExamStudent } from './types';
import { ExamPreparationStatus } from '@/lib/examMatching';

interface ExamOverviewTableProps {
  students: EnrichedExamStudent[];
  isLoading: boolean;
  slug: string;
  isLight?: boolean;
}

const STATUS_CONFIG: Record<ExamPreparationStatus, { label: string; bg: string; text: string; border: string }> = {
  urgent: {
    label: '최우선',
    bg: 'bg-rose-500/15',
    text: 'text-rose-500 dark:text-rose-400',
    border: 'border-rose-500/30'
  },
  ongoing: {
    label: '진행 중',
    bg: 'bg-purple-500/15',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30'
  },
  d7: {
    label: 'D-7 이내',
    bg: 'bg-red-500/15',
    text: 'text-red-500 dark:text-red-400',
    border: 'border-red-500/30'
  },
  lack_classes: {
    label: '수업 부족',
    bg: 'bg-orange-500/15',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-500/30'
  },
  d14: {
    label: 'D-14 이내',
    bg: 'bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30'
  },
  normal: {
    label: '여유',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30'
  },
  no_schedule: {
    label: '미등록',
    bg: 'bg-gray-500/15',
    text: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-500/30'
  }
};

export const ExamOverviewTable: React.FC<ExamOverviewTableProps> = ({
  students,
  isLoading,
  slug,
  isLight = false
}) => {
  if (isLoading) {
    return (
      <div className={`p-8 rounded-lg border text-center ${
        isLight ? 'bg-white border-[#e3e2e0]' : 'bg-[#0f0f0f] border-white/10'
      }`}>
        <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          학원 전체 학생의 시험 일정을 분석하고 있습니다...
        </p>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className={`p-12 rounded-lg border text-center ${
        isLight ? 'bg-white border-[#e3e2e0]' : 'bg-[#0f0f0f] border-white/10'
      }`}>
        <Calendar size={32} className={`mx-auto mb-2.5 ${isLight ? 'text-gray-300' : 'text-gray-600'}`} />
        <p className={`text-sm font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
          조건에 부합하는 학생이 없습니다
        </p>
        <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
          검색어 또는 필터 조건을 조정해 보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={`rounded-lg border overflow-hidden shadow-xs ${
        isLight ? 'bg-white border-[#e3e2e0]' : 'bg-[#0f0f0f] border-white/10'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${
                isLight ? 'bg-gray-50 border-[#e3e2e0] text-gray-600' : 'bg-white/5 border-white/10 text-gray-400'
              }`}>
                <th className="py-2.5 px-3 font-semibold w-12 text-center">No</th>
                <th className="py-2.5 px-3 font-semibold min-w-[120px]">학생명</th>
                <th className="py-2.5 px-3 font-semibold min-w-[130px]">학교·학년</th>
                <th className="py-2.5 px-3 font-semibold min-w-[100px]">담당 교사</th>
                <th className="py-2.5 px-3 font-semibold min-w-[110px]">정규 등원</th>
                <th className="py-2.5 px-3 font-semibold min-w-[140px]">시험명</th>
                <th className="py-2.5 px-3 font-semibold min-w-[110px]">시험 기간</th>
                <th className="py-2.5 px-3 font-semibold min-w-[90px] text-center">D-Day</th>
                <th className="py-2.5 px-3 font-semibold min-w-[100px] text-center">잔여 정규수업</th>
                <th className="py-2.5 px-3 font-semibold min-w-[95px] text-center">대비 상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/5">
              {students.map((student, idx) => {
                const statusCfg = STATUS_CONFIG[student.status];
                const studentUrl = `/${slug}/student?id=${student.id}`;

                // D-Day 강조 색상
                let dDayBadgeClass = isLight ? 'bg-gray-100 text-gray-700' : 'bg-white/10 text-gray-300';
                if (student.isOngoing) {
                  dDayBadgeClass = 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold';
                } else if (student.matchedExam) {
                  if (student.dDayDiff <= 7) {
                    dDayBadgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold';
                  } else if (student.dDayDiff <= 14) {
                    dDayBadgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold';
                  }
                }

                // 잔여 수업 강조 (4회 이하 경고)
                const isLackClasses =
                  !student.isOngoing &&
                  student.matchedExam !== null &&
                  student.remainingClasses !== null &&
                  student.remainingClasses <= 4;

                return (
                  <tr
                    key={student.id}
                    className={`transition-colors ${
                      isLight ? 'hover:bg-blue-50/40' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* 번호 */}
                    <td className={`py-2 px-3 text-center ${isLight ? 'text-gray-400' : 'text-gray-600'}`}>
                      {idx + 1}
                    </td>

                    {/* 학생명 + 개별 링크 */}
                    <td className="py-2 px-3">
                      <a
                        href={studentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 font-bold group ${
                          isLight
                            ? 'text-gray-900 hover:text-blue-600'
                            : 'text-white hover:text-blue-400'
                        }`}
                      >
                        <span>{student.name}</span>
                        <ExternalLink
                          size={12}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 shrink-0"
                        />
                      </a>
                    </td>

                    {/* 학교 / 학년 */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`font-medium ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                          {student.school}
                        </span>
                        {student.grade && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/10 text-gray-400'
                          }`}>
                            {student.grade}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 담당 선생님 */}
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${
                        isLight ? 'bg-gray-100 text-gray-700' : 'bg-white/5 text-gray-300'
                      }`}>
                        <span className="font-semibold">{student.teacherName}</span>
                        {student.teacherInitial && student.teacherInitial !== '?' && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            ({student.teacherInitial})
                          </span>
                        )}
                      </span>
                    </td>

                    {/* 정규 등원 요일 */}
                    <td className="py-2 px-3">
                      {student.classDays.length > 0 ? (
                        <div className="flex items-center gap-0.5 flex-wrap">
                          {student.classDays.map(day => (
                            <span
                              key={day}
                              className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center ${
                                isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/10 text-blue-300'
                              }`}
                            >
                              {day}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className={`text-[11px] ${isLight ? 'text-gray-400' : 'text-gray-600'}`}>
                          미지정
                        </span>
                      )}
                    </td>

                    {/* 가장 가까운 시험명 */}
                    <td className="py-2 px-3">
                      <span className={`font-medium ${
                        student.matchedExam
                          ? (isLight ? 'text-gray-800' : 'text-gray-200')
                          : (isLight ? 'text-gray-400 italic' : 'text-gray-600 italic')
                      }`}>
                        {student.examName}
                      </span>
                    </td>

                    {/* 시험 기간 */}
                    <td className="py-2 px-3 font-mono text-[11px]">
                      <span className={student.matchedExam ? (isLight ? 'text-gray-600' : 'text-gray-400') : (isLight ? 'text-gray-300' : 'text-gray-600')}>
                        {student.examPeriodStr}
                      </span>
                    </td>

                    {/* D-Day */}
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${dDayBadgeClass}`}>
                        {student.dDayLabel}
                      </span>
                    </td>

                    {/* 잔여 정규수업 */}
                    <td className="py-2 px-3 text-center">
                      {student.isOngoing ? (
                        <span className="text-purple-500 font-semibold text-xs">진행 중</span>
                      ) : student.remainingClasses !== null ? (
                        <div className="inline-flex items-center gap-1">
                          <span className={`font-bold font-mono text-xs ${
                            isLackClasses ? 'text-rose-500 dark:text-rose-400' : (isLight ? 'text-gray-800' : 'text-gray-200')
                          }`}>
                            {student.remainingClasses}회
                          </span>
                          {isLackClasses && (
                            <AlertTriangle size={11} className="text-rose-500 shrink-0" />
                          )}
                        </div>
                      ) : (
                        <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-gray-600'}`}>—</span>
                      )}
                    </td>

                    {/* 대비 상태 배지 */}
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 안내 문구 */}
      <div className={`flex items-center justify-between text-[11px] px-1 ${
        isLight ? 'text-gray-500' : 'text-gray-500'
      }`}>
        <p>
          ※ <strong>잔여 정규수업</strong>은 학생 정보에 등록된 정규 등원 요일 기준 예상 횟수이며, 특강/선택과목 및 보강 일정은 포함되지 않습니다.
        </p>
        <p>
          ※ 학생 이름을 클릭하면 해당 학생의 관리 페이지가 새 창으로 열립니다.
        </p>
      </div>
    </div>
  );
};
