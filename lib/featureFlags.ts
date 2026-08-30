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
 * 로딩 전(academy 객체 또는 id 부재)에는 깜빡임 방지를 위해 all false 반환.
 * academy 로드 완료 후 operation_settings.features가 없거나 누락된 키가 있으면 기본값(true)으로 fallback합니다.
 */
export function getAcademyFeatures(academy: any): AcademyFeatureFlags {
  if (!academy || !academy.id) {
    return {
      operations_tools: false,
      learning_resources: false,
      assessment_tools: false,
    };
  }

  const rawFeatures = academy.operation_settings?.features;
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
 * 1. 로딩 전 (academy가 null/undefined이거나 id가 없는 상태): 깜빡임(Flash) 방지를 위해 false 반환
 * 2. academy 로드 완료 후:
 *    - features 객체가 없으면 기존 학원 호환을 위해 true
 *    - 명시적으로 false로 설정된 경우에만 false 반환
 */
export function isFeatureEnabled(academy: any, key: AcademyFeatureKey): boolean {
  if (!academy || !academy.id) return false;
  const rawFeatures = academy.operation_settings?.features;
  if (!rawFeatures || typeof rawFeatures !== 'object') return true;
  return rawFeatures[key] !== false;
}
