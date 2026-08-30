/**
 * 학원 시간표/수업 시간 공용 변환 및 포맷 유틸리티
 *
 * 지원 포맷:
 * 1. 기존 정각 데이터: 0 ~ 23 (예: 16 -> 16:00, 4 -> 16:00 오후보정, 9 -> 09:00 오전)
 * 2. HHMM 데이터: 930 -> 09:30, 1600 -> 16:00, 1620 -> 16:20, 1730 -> 17:30, 420 -> 16:20
 */

/**
 * 다양한 raw 시간 표현값을 자정 기준 분(minutes, 0~1439)으로 변환
 * 유효하지 않거나 미지정인 경우 null 반환
 */
export const scheduleValueToMinutes = (
  value: number | string | null | undefined
): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (raw === 99 || raw === 999) return null;

  // 1. 기존 정각 데이터: 0 ~ 23
  if (raw >= 0 && raw <= 23) {
    let h = raw;
    // 1 ~ 7시는 학원 오후 수업(13~19시)으로 보정, 8~12시는 오전/정오 그대로 유지
    if (h > 0 && h < 8) h += 12;
    return h * 60;
  }

  // 2. HHMM 포맷 데이터: 100 ~ 2400 (예: 930, 1600, 1620, 1730, 1830, 420 등)
  let hour = Math.floor(raw / 100);
  const minute = raw % 100;

  // 100 ~ 759 중 hour가 1~7인 경우 (예: 420 -> 4시 20분 -> 오후 16시 20분)
  if (hour > 0 && hour < 8) {
    hour += 12;
  }

  if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
    return hour * 60 + minute;
  }

  return null;
};

/**
 * 이미 자정 기준 분(minutes, 0~1439)으로 계산된 값을 "오후 4:20" 등의 표준 문자열로 포맷
 */
export const minutesToFormattedTime = (
  minutes: number | null | undefined
): string => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0 || minutes >= 999 * 60) {
    return '';
  }
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;

  const period = hour24 < 12 ? '오전' : '오후';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${period} ${hour12}:${String(minute).padStart(2, '0')}`;
};

/**
 * 이미 자정 기준 분(minutes)인 값을 "오후 4:20 수업", "기타 수업" 등의 배지 라벨로 포맷
 */
export const minutesToGroupLabel = (
  minutes: number | null | undefined
): string => {
  const formatted = minutesToFormattedTime(minutes);
  if (!formatted) return '기타 수업';
  return `${formatted} 수업`;
};

/**
 * raw 시간값(0~23, HHMM)을 받아 "오후 4:20" 등의 표준 문자열로 포맷
 */
export const formatScheduleTime = (
  rawValue: number | string | null | undefined
): string => {
  const totalMinutes = scheduleValueToMinutes(rawValue);
  return minutesToFormattedTime(totalMinutes);
};

/**
 * raw 시간값(0~23, HHMM)을 받아 "오후 4:20 수업" 등의 배지 라벨로 포맷
 */
export const formatScheduleGroupLabel = (
  rawValue: number | string | null | undefined
): string => {
  const totalMinutes = scheduleValueToMinutes(rawValue);
  return minutesToGroupLabel(totalMinutes);
};

/**
 * "17:30", "09:30" 같은 time input 문자열(HH:mm)을 HHMM 숫자(1730, 930)로 변환
 * 유효하지 않거나 빈 값인 경우 null 반환
 */
export const timeInputToScheduleValue = (
  value: string | null | undefined
): number | null => {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 100 + minute;
};

/**
 * 원본 시간값(16, 1600, 1620, 1730, 1900 등)을 <input type="time"> 표출용 "HH:mm" 문자열로 변환
 */
export const scheduleValueToTimeInput = (
  rawValue: number | string | null | undefined
): string => {
  const minutes = scheduleValueToMinutes(rawValue);
  if (minutes === null) return '';

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};
