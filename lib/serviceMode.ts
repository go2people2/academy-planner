import { SupabaseClient } from '@supabase/supabase-js';

export type ServiceMode = 'integrated' | 'standalone_hokmanote' | 'unspecified';

/**
 * 💡 학원의 서비스 모드 정책 확인
 *
 * 규칙:
 * 1. operation_settings.service_mode가 'standalone_hokmanote'인 경우만 전용 학원으로 인정
 * 2. operation_settings.service_mode가 'integrated'인 경우 통합 학원
 * 3. 미설정, 불명확, 혹은 통신/DB 오류 시 'unspecified' 반환 (오답노트 종료 요청 차단 기준)
 * 4. 이용권 만료/정지 상태로 자동 전용 전환 절대 금지
 */
export async function getAcademyServiceMode(
  academyId: string,
  supabase: SupabaseClient
): Promise<ServiceMode> {
  try {
    const { data, error } = await supabase
      .from('ams_academies')
      .select('operation_settings')
      .eq('id', academyId)
      .maybeSingle();

    if (error || !data) {
      console.error(`[ServiceMode] Failed to fetch academy settings for ${academyId}:`, error);
      return 'unspecified';
    }

    const settings = data.operation_settings;
    if (!settings || typeof settings !== 'object') {
      return 'unspecified';
    }

    const mode = settings.service_mode;
    if (mode === 'standalone_hokmanote') {
      return 'standalone_hokmanote';
    }
    if (mode === 'integrated') {
      return 'integrated';
    }

    // 미설정 또는 다른 값일 경우 안전하게 unspecified 반환
    return 'unspecified';
  } catch (err) {
    console.error(`[ServiceMode] Unexpected exception for ${academyId}:`, err);
    return 'unspecified';
  }
}
