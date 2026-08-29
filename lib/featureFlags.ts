/**
 * Academy Feature Flags Utility
 * 다중 학원 SaaS 확장을 위한 학원별 기능 ON/OFF 제어 유틸리티
 */

export type AcademyFeatureKey =
  | 'operations_tools'
  | 'learning_resources'
  | 'assessment_tools';

export interface AcademyFeatureFlags {
  operations_tools: boolean;
  learning_resources: boolean;
  assessment_tools: boolean;
}

export const DEFAULT_ACADEMY_FEATURES: AcademyFeatureFlags = {
  operations_tools: true,
  learning_resources: true,
  assessment_tools: true,
};

/**
 * 학원 객체로부터 기능 플래그 맵을 안전하게 추출합니다.
 * operation_settings.features가 없거나 누락된 키가 있으면 기본값(true)으로 fallback합니다.
 */
export function getAcademyFeatures(academy: any): AcademyFeatureFlags {
  if (!academy || !academy.operation_settings || typeof academy.operation_settings !== 'object') {
    return { ...DEFAULT_ACADEMY_FEATURES };
  }

  const rawFeatures = academy.operation_settings.features;
  if (!rawFeatures || typeof rawFeatures !== 'object') {
    return { ...DEFAULT_ACADEMY_FEATURES };
  }

  return {
    operations_tools: rawFeatures.operations_tools !== false,
    learning_resources: rawFeatures.learning_resources !== false,
    assessment_tools: rawFeatures.assessment_tools !== false,
  };
}

/**
 * 특정 기능 플래그가 활성화되어 있는지 확인합니다.
 * 명시적으로 false로 설정된 경우에만 false를 반환하고, 그 외의 경우(undefined, null 등)는 true를 반환합니다.
 */
export function isFeatureEnabled(academy: any, key: AcademyFeatureKey): boolean {
  if (!academy) return true;
  const rawFeatures = academy?.operation_settings?.features;
  if (!rawFeatures || typeof rawFeatures !== 'object') return true;
  return rawFeatures[key] !== false;
}
