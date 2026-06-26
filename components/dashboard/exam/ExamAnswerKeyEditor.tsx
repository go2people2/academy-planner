'use client';

import React, { useState } from 'react';
import type { QuestionType } from '@/types/exam';
import {
  TYPE_LABELS,
  TYPE_CYCLE,
  BUBBLE_SYMBOLS,
  containerStyle,
  headerStyle,
  gridStyle,
  rowStyle,
  qNumStyle,
  bubblesContainerStyle,
  makeBubbleStyle,
  shortAnswerInputStyle,
  essayLabelStyle,
  essayPointsInputStyle,
  toggleBtnStyle,
} from './examAnswerKeyStyles';

interface ExamAnswerKeyEditorProps {
  questionCount: number;
  answerKey: Record<string, number | string | number[]>;
  questionTypes: Record<string, QuestionType>;
  essayQuestions: Array<{ q: number; points: number }>;
  onAnswerKeyChange: (key: Record<string, number | string | number[]>) => void;
  onQuestionTypesChange: (types: Record<string, QuestionType>) => void;
  onEssayQuestionsChange: (essays: Array<{ q: number; points: number }>) => void;
  readOnly?: boolean;
}

export default function ExamAnswerKeyEditor({
  questionCount,
  answerKey,
  questionTypes,
  essayQuestions,
  onAnswerKeyChange,
  onQuestionTypesChange,
  onEssayQuestionsChange,
  readOnly = false,
}: ExamAnswerKeyEditorProps) {
  // 개별 버블 호버 감지 상태 ('q-choice' 형태, 예: '1-3')
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);

  // 💡 사용자가 직접 수동 수정한 문제 번호 목록 추적 State
  const [editedQuestions, setEditedQuestions] = useState<Set<number>>(new Set());

  // 유형 전환 핸들러
  const handleTypeToggle = (qNum: number) => {
    if (readOnly) return;
    const qKey = qNum.toString();
    const currentType = questionTypes[qKey] || 'multiple_choice';
    const currentIndex = TYPE_CYCLE.indexOf(currentType);
    const nextType = TYPE_CYCLE[(currentIndex + 1) % TYPE_CYCLE.length];

    // 1. 유형 업데이트
    const updatedTypes = { ...questionTypes, [qKey]: nextType };
    onQuestionTypesChange(updatedTypes);

    // 2. 답안 업데이트 (유형 변환 시 기존에 입력되어 있던 배점 배열은 날리지 않고 유지)
    const updatedAnswerKey = { ...answerKey };

    if (nextType === 'multiple_choice') {
      updatedAnswerKey[qKey] = 1; // 기본 1번
    } else if (nextType === 'multiple_choice_multi') {
      updatedAnswerKey[qKey] = []; // 복수정답 전환 시 빈 배열 기본값
    } else if (nextType === 'short_answer') {
      updatedAnswerKey[qKey] = ''; // 빈 문자열
    } else if (nextType === 'essay') {
      updatedAnswerKey[qKey] = '서술형';
    }

    onAnswerKeyChange(updatedAnswerKey);
  };

  // 객관식 답안 마킹 핸들러 (유형에 맞춰 복수정답 또는 단일선택 제어)
  const handleBubbleClick = (qNum: number, choice: number, type: QuestionType) => {
    if (readOnly) return;
    const qKey = qNum.toString();
    const currentVal = answerKey[qKey];
    
    let newVal: any;

    if (type === 'multiple_choice_multi') {
      // 💡 복수정답 유형일 때만 다중 선택 및 해제 토글 허용
      if (Array.isArray(currentVal)) {
        if (currentVal.includes(choice)) {
          newVal = currentVal.filter((c) => c !== choice);
        } else {
          newVal = [...currentVal, choice].sort((a, b) => a - b);
        }
      } else if (typeof currentVal === 'number' || typeof currentVal === 'string') {
        const numVal = Number(currentVal);
        if (!isNaN(numVal)) {
          if (numVal === choice) {
            newVal = [];
          } else {
            newVal = [numVal, choice].sort((a, b) => a - b);
          }
        } else {
          newVal = [choice];
        }
      } else {
        newVal = [choice];
      }
    } else {
      // 💡 일반 객관식 유형일 때는 기존처럼 오직 단일 선택만 가능 (동일 번호 재클릭 시 토글 해제)
      const numVal = Number(currentVal);
      if (numVal === choice) {
        newVal = null; // 선택 해제
      } else {
        newVal = choice; // 새로운 정답 선택
      }
    }

    onAnswerKeyChange({
      ...answerKey,
      [qKey]: newVal,
    });
  };

  // 단답형 답안 입력 핸들러
  const handleShortAnswerChange = (qNum: number, value: string) => {
    if (readOnly) return;
    onAnswerKeyChange({
      ...answerKey,
      [qNum.toString()]: value,
    });
  };

  // 💡 공통 문항 배점 입력 핸들러 (모든 유형 지원)
  const handlePointsChange = (qNum: number, points: number) => {
    if (readOnly) return;

    // 수동 수정 이력 기록
    setEditedQuestions((prev) => {
      const next = new Set(prev);
      next.add(qNum);
      return next;
    });

    const exists = essayQuestions.some((item) => item.q === qNum);
    let updatedEssays;
    if (exists) {
      updatedEssays = essayQuestions.map((item) =>
        item.q === qNum ? { ...item, points } : item
      );
    } else {
      updatedEssays = [...essayQuestions, { q: qNum, points }];
    }
    onEssayQuestionsChange(updatedEssays);
  };

  // 💡 수동 고정 점수를 제외하고 남은 점수를 분배하는 100점 스마트 배점 부여 알고리즘
  const handleSmartPoints = () => {
    if (readOnly) return;
    const N = questionCount;
    if (N <= 0) return;

    // 1. 수동으로 고정된 문항들의 점수 합산 계산
    const fixedScores: Record<number, number> = {};
    let fixedSum = 0;
    
    editedQuestions.forEach((q) => {
      if (q <= N) {
        const essayItem = essayQuestions.find((item) => item.q === q);
        // 설정 정보가 없으면 기본값인 4점 (스마트 배분 시 임의 수동 고정값 기본)
        const points = essayItem ? essayItem.points : 4;
        fixedScores[q] = points;
        fixedSum += points;
      }
    });

    // 2. 남은 점수가 0 이하인지 체크
    const remainingPoints = 100 - fixedSum;
    if (remainingPoints <= 0) {
      alert(`⚠️ 수동 설정된 배점의 합계(${fixedSum.toFixed(1)}점)가 이미 100점 이상이어서 스마트 배분을 진행할 수 없습니다.`);
      return;
    }

    // 3. 아직 사용자가 수동 수정하지 않은 남은 문항 리스트 추출
    const remainingQs: number[] = [];
    for (let q = 1; q <= N; q++) {
      if (!editedQuestions.has(q)) {
        remainingQs.push(q);
      }
    }

    const remainingCount = remainingQs.length;
    if (remainingCount === 0) {
      alert('⚠️ 모든 문항의 배점이 수동으로 고정되어 분배할 남은 문항이 없습니다.');
      return;
    }

    // 4. 0.1점 단위 스마트 분배 연산 (오차 없는 정수 연산을 위해 10을 곱함)
    const targetTenths = Math.round(remainingPoints * 10);
    const baseTenths = Math.floor(targetTenths / remainingCount);
    const remainderTenths = targetTenths % remainingCount;

    // 새롭게 전달할 배점 목록 생성 (수동 고정된 배점 포함)
    const newEssays = [...essayQuestions];

    remainingQs.forEach((q, idx) => {
      // 뒤쪽 remainderTenths개 문항에 0.1점씩 추가 얹어줌
      const isHighPoints = idx >= (remainingCount - remainderTenths);
      const pointsTenths = baseTenths + (isHighPoints ? 1 : 0);
      const points = pointsTenths > 0 ? pointsTenths / 10 : 0.1; // 최소 0.1점 보장

      const essayIdx = newEssays.findIndex((item) => item.q === q);
      if (essayIdx > -1) {
        newEssays[essayIdx] = { q, points };
      } else {
        newEssays.push({ q, points });
      }
    });

    onEssayQuestionsChange(newEssays);
  };

  // 💡 수동 입력 모드 (모든 배점 기록 및 수동 고정 상태를 깨끗이 비워 입력 편의성 확보)
  const handleManualPoints = () => {
    if (readOnly) return;
    setEditedQuestions(new Set());
    onEssayQuestionsChange([]);
  };

  // 실시간 총 배점 계산 (부동 소수점 오차 방지 - 초기 미입력 문항은 0점 처리)
  const rawTotal = Array.from({ length: questionCount }, (_, i) => {
    const qNum = i + 1;
    const essayItem = essayQuestions.find((item) => item.q === qNum);
    return essayItem ? essayItem.points : 0; // 초기 빈 칸 문항은 0점 처리
  }).reduce((sum, p) => sum + p, 0);

  const totalPoints = Math.round(rawTotal * 100) / 100;
  const isTotal100 = totalPoints === 100;

  // 세로형(Column-major) 문항 배치 순서 재배열
  const questions = (() => {
    const arr = [];
    const half = Math.ceil(questionCount / 2);
    for (let i = 0; i < half; i++) {
      arr.push(i + 1); // 왼쪽 열 추가
      if (i + 1 + half <= questionCount) {
        arr.push(i + 1 + half); // 오른쪽 열 추가
      }
    }
    return arr;
  })();

  return (
    <div style={containerStyle}>
      {/* 💡 헤더에 실시간 총점 모니터링 뱃지 및 분리된 버튼 2개 배치 */}
      <div style={{ ...headerStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>✏️ 정답 및 문항 유형 입력</span>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            background: isTotal100 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
            color: isTotal100 ? '#10b981' : '#f59e0b',
            border: `1px solid ${isTotal100 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
            padding: '4px 10px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4
          }}>
            합계: {totalPoints}점 {isTotal100 ? '🟢 (완성)' : '⚠️ (100점을 맞춰주세요)'}
          </span>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleManualPoints}
              style={{
                background: 'rgba(124, 58, 237, 0.1)',
                color: '#a78bfa',
                border: '1px dashed #7c3aed',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              ✏️ 수동 입력 (배점 비우기)
            </button>
            <button
              type="button"
              onClick={handleSmartPoints}
              style={{
                background: 'linear-gradient(135deg, #4361ee 0%, #3a56d4 100%)',
                color: '#fff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(67,97,238,0.25)',
                transition: 'all 0.15s',
              }}
            >
              💡 100점 스마트 배점 부여
            </button>
          </div>
        )}
      </div>

      <div style={gridStyle}>
        {questions.map((qNum) => {
          const qKey = qNum.toString();
          const type = questionTypes[qKey] || 'multiple_choice';
          const answer = answerKey[qKey];
          const essayItem = essayQuestions.find((item) => item.q === qNum);
          
          const isFiveMultiple = qNum % 5 === 0;

          // 💡 5의 배수 줄에 대해 시각적 구분을 위한 미세 초록 배경 및 테두리 효과 추가
          const customRowStyle: React.CSSProperties = {
            ...rowStyle,
            ...(isFiveMultiple ? {
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.18)',
            } : {
              border: '1px solid transparent' // 정렬 유지를 위해 투명 테두리 기본 적용
            })
          };

          // 💡 5의 배수 문항 번호에 대해 강조 색상(에메랄드 초록색) 및 볼드 처리
          const customQNumStyle: React.CSSProperties = {
            ...qNumStyle,
            ...(isFiveMultiple ? {
              color: '#34d399',
              fontWeight: 800,
            } : {})
          };

          return (
            <div key={qNum} style={customRowStyle}>
              {/* 문항 번호 */}
              <div style={customQNumStyle}>{qNum}번</div>

              {/* 유형 전환 버튼 */}
              <button
                type="button"
                onClick={() => handleTypeToggle(qNum)}
                style={toggleBtnStyle(readOnly)}
                disabled={readOnly}
              >
                {TYPE_LABELS[type]}
              </button>

              {/* 정답 입력란 (유형별 분기 - 객관식 및 복수정답 둘 다 OMR 버블 렌더링) */}
              {(type === 'multiple_choice' || type === 'multiple_choice_multi') ? (
                <div style={bubblesContainerStyle}>
                  {[1, 2, 3, 4, 5].map((choice) => {
                    const bubbleId = `${qNum}-${choice}`;
                    // 복수 정답(배열)인지 단일 값인지 유연하게 확인
                    const isSelected = Array.isArray(answer)
                      ? answer.map(Number).includes(choice)
                      : Number(answer) === choice;
                    const isHovered = hoveredBubble === bubbleId;

                    return (
                      <button
                        key={choice}
                        type="button"
                        style={makeBubbleStyle(isSelected, readOnly, isHovered, isFiveMultiple)}
                        onMouseEnter={() => !readOnly && setHoveredBubble(bubbleId)}
                        onMouseLeave={() => !readOnly && setHoveredBubble(null)}
                        onClick={() => handleBubbleClick(qNum, choice, type)}
                        disabled={readOnly}
                      >
                        {BUBBLE_SYMBOLS[choice - 1]}
                      </button>
                    );
                  })}
                </div>
              ) : type === 'short_answer' ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="text"
                    value={typeof answer === 'string' ? answer : ''}
                    placeholder="숫자/답안 입력"
                    onChange={(e) => handleShortAnswerChange(qNum, e.target.value)}
                    style={shortAnswerInputStyle}
                    disabled={readOnly}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#64748b', fontSize: 11, fontWeight: 600 }}>
                  (서술형 정답 없음)
                </div>
              )}

              {/* 💡 공통 배점 입력 구역 (수동 기입 편의를 위해 0점/미입력은 빈 칸으로 렌더링) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, paddingLeft: 4 }}>
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  placeholder="-"
                  value={essayItem ? (essayItem.points === 0 ? '' : essayItem.points) : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const numVal = val === '' ? 0 : parseFloat(val);
                    handlePointsChange(qNum, numVal);
                  }}
                  style={{
                    ...essayPointsInputStyle,
                    width: 42,
                    height: 28,
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(0,0,0,0.2)',
                    color: '#e2e8f0',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                  disabled={readOnly}
                />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>점</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
