// ExamAnswerKeyEditor 스타일 및 상수 정의
import { CSSProperties } from 'react';
import type { QuestionType } from '@/types/exam';

/** 문항 유형 라벨 */
export const TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: '객관식',
  multiple_choice_multi: '복수정답',
  short_answer: '단답형',
  essay: '서술형',
};

/** 유형 순환 순서 */
export const TYPE_CYCLE: QuestionType[] = ['multiple_choice', 'multiple_choice_multi', 'short_answer', 'essay'];

/** OMR 버블 번호 기호 */
export const BUBBLE_SYMBOLS = ['①', '②', '③', '④', '⑤'];

// ── 색상 팔레트 ──
const COLORS = {
  bg: '#1a1a2e',
  cardBg: '#16213e',
  surface: '#0f3460',
  accent: '#4361ee',
  accentHover: '#3a56d4',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  border: '#334155',
  bubbleBg: 'rgba(255,255,255,0.06)',
  bubbleHover: 'rgba(67,97,238,0.2)',
  inputBg: 'rgba(255,255,255,0.08)',
  toggleBg: 'rgba(255,255,255,0.05)',
  toggleHover: 'rgba(67,97,238,0.15)',
  essayBadge: '#7c3aed',
};

// ── 스타일 정의 ──

export const containerStyle: CSSProperties = {
  background: COLORS.bg,
  borderRadius: 16,
  padding: '24px 20px',
  fontFamily: "'Pretendard', -apple-system, sans-serif",
  color: COLORS.text,
};

export const headerStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '2px 24px',
};

export const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 8px',
  borderRadius: 10,
  background: COLORS.cardBg,
  transition: 'background 0.15s',
  minHeight: 48,
};

export const qNumStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 14,
  minWidth: 28,
  textAlign: 'right',
  color: COLORS.textMuted,
  flexShrink: 0,
};

export const bubblesContainerStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  flex: 1,
  justifyContent: 'center',
};

export const makeBubbleStyle = (
  selected: boolean,
  readOnly: boolean,
  hovered: boolean,
  isFiveMultiple?: boolean
): CSSProperties => {
  const borderCol = selected
    ? (isFiveMultiple ? '#10b981' : COLORS.accent) // 💡 5의 배수 마킹 시 초록색 테두리
    : COLORS.border; // 💡 선택 안 되었을 때는 5의 배수 여부와 무관하게 동일한 회색 테두리

  const textCol = selected
    ? '#fff'
    : COLORS.textMuted; // 💡 선택 안 되었을 때는 동일하게 회색 보기 번호

  const bg = selected
    ? (isFiveMultiple ? '#10b981' : COLORS.accent) // 💡 5의 배수 마킹 시 초록색 채우기
    : hovered
      ? COLORS.bubbleHover
      : COLORS.bubbleBg;

  return {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `2px solid ${borderCol}`,
    background: bg,
    color: textCol,
    fontSize: 15,
    fontWeight: selected ? 700 : 400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: readOnly ? 'default' : 'pointer',
    transition: 'all 0.18s cubic-bezier(.4,0,.2,1)',
    transform: selected ? 'scale(1.1)' : hovered ? 'scale(1.05)' : 'scale(1)',
    boxShadow: selected 
      ? `0 0 12px ${isFiveMultiple ? '#10b981' : COLORS.accent}55` 
      : 'none',
    userSelect: 'none',
  };
};

export const shortAnswerInputStyle: CSSProperties = {
  flex: 1,
  maxWidth: 120,
  height: 34,
  borderRadius: 8,
  border: `1.5px solid ${COLORS.border}`,
  background: COLORS.inputBg,
  color: COLORS.text,
  fontSize: 15,
  fontWeight: 600,
  textAlign: 'center',
  outline: 'none',
  transition: 'border-color 0.15s',
};

export const essayLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: COLORS.essayBadge,
  background: `${COLORS.essayBadge}22`,
  padding: '4px 10px',
  borderRadius: 6,
};

export const essayPointsInputStyle: CSSProperties = {
  width: 52,
  height: 30,
  borderRadius: 6,
  border: `1.5px solid ${COLORS.border}`,
  background: COLORS.inputBg,
  color: COLORS.text,
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  outline: 'none',
};

export const toggleBtnStyle = (readOnly: boolean): CSSProperties => ({
  fontSize: 11,
  fontWeight: 500,
  padding: '3px 8px',
  borderRadius: 6,
  border: `1px solid ${COLORS.border}`,
  background: COLORS.toggleBg,
  color: COLORS.textMuted,
  cursor: readOnly ? 'default' : 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
  flexShrink: 0,
});
